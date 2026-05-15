import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePlan, generateTwin, generateReply, parseOnboardingReply } from "@/lib/llm";
import { fillTemplate, REPLY_PROMPT } from "@/lib/prompts";
import { scheduleNudge } from "@/lib/openclaw";
import { format, startOfDay } from "date-fns";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const execAsync = promisify(exec);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "805422072";
const TIMEZONE = "Asia/Singapore";

// Simple flag file to track if we're waiting for the onboarding reply
const WAITING_FLAG = path.resolve(process.cwd(), ".onboarding-waiting");
const GENERATING_FLAG = path.resolve(process.cwd(), ".onboarding-generating");

let lastOffset = 0;

async function send(text: string) {
  await execAsync(
    `openclaw message send --channel telegram --target ${CHAT_ID} -m ${JSON.stringify(text)}`
  );
}

const ONBOARDING_PROMPT = `hey. answer these and i'll build your plan:

1. goal?
2. why does it matter?
3. timeline — 30, 60, or 90 days?
4. hours/day you can commit? (1–8)
5. wake time / sleep time? (e.g. 07:30 / 23:00)
6. blocked times? (e.g. work 09:00–17:00) or none
7. where are you starting from? (current skill/fitness level)
8. twin name? (or pick: Mira, Kai, Zoe)
9. twin vibe? (e.g. "chill but focused, lowercase")

just reply naturally — doesn't have to be numbered.`;

async function runGeneration(userReply: string) {
  fs.writeFileSync(GENERATING_FLAG, "1");
  try {
    await send("parsing your answers and generating the plan...");

    const parsed = await parseOnboardingReply(userReply, TIMEZONE);
    if (!parsed) throw new Error("Failed to parse onboarding reply");

    const input = { ...parsed, timezone: TIMEZONE };

    // Clear old data
    await db.block.deleteMany({});
    await db.message.deleteMany({});
    const twin = await db.twin.findUnique({ where: { userId: 1 } });
    if (twin) {
      await db.twinBlock.deleteMany({ where: { twinId: twin.id } });
      await db.twin.delete({ where: { userId: 1 } });
    }
    await db.user.deleteMany({});

    await db.user.create({
      data: {
        id: 1,
        goal: input.goal,
        whyItMatters: input.whyItMatters,
        timelineDays: input.timelineDays,
        dailyHours: input.dailyHours,
        wakeTime: input.wakeTime,
        sleepTime: input.sleepTime,
        blockedTimes: JSON.stringify(input.blockedTimes),
        currentLevel: input.currentLevel,
        timezone: input.timezone,
      },
    });

    const blocks = await generatePlan(input);
    const twinData = await generateTwin(input, blocks);

    await db.block.createMany({ data: blocks.map((b) => ({ userId: 1, ...b })) });

    const createdTwin = await db.twin.create({
      data: {
        userId: 1,
        name: input.twinName,
        personality: twinData.personality,
        speechStyle: twinData.speechStyle,
      },
    });

    await db.twinBlock.createMany({
      data: twinData.twinBlocks.map((tb) => ({ twinId: createdTwin.id, ...tb })),
    });

    // Schedule today's future blocks
    const now = new Date();
    for (const block of blocks.filter((b) => b.dayNumber === 1)) {
      const [h, m] = block.startTime.split(":").map(Number);
      const blockDate = new Date(startOfDay(now));
      blockDate.setHours(h, m, 0, 0);
      if (blockDate <= now) continue;
      const isoTime = format(blockDate, "yyyy-MM-dd'T'HH:mm:ss");
      const persisted = await db.block.findFirst({ where: { userId: 1, dayNumber: 1, startTime: block.startTime } });
      if (persisted) {
        try { await scheduleNudge(persisted.id, isoTime, input.timezone); } catch { /* best effort */ }
      }
    }

    await send(
      `done. ${input.twinName} is ready.\n\nshe'll text you at your first scheduled block. text her anytime — she'll reply in character.\n\n/reset to start over.`
    );
  } catch (err) {
    console.error("Generation error:", err);
    await send("something went wrong. try /start again");
  } finally {
    if (fs.existsSync(WAITING_FLAG)) fs.unlinkSync(WAITING_FLAG);
    if (fs.existsSync(GENERATING_FLAG)) fs.unlinkSync(GENERATING_FLAG);
  }
}

export async function POST() {
  if (!BOT_TOKEN) return NextResponse.json({ error: "no token" }, { status: 500 });

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastOffset + 1}&timeout=0&limit=10`
    );
    const data = await res.json();
    if (!data.ok || !data.result?.length) return NextResponse.json({ processed: 0 });

    const updates = data.result;
    lastOffset = updates[updates.length - 1].update_id;

    let processed = 0;
    for (const update of updates) {
      const msg = update.message;
      if (!msg?.text || String(msg.chat.id) !== CHAT_ID) continue;
      const text = msg.text.trim();

      // /start
      if (text === "/start") {
        const user = await db.user.findUnique({ where: { id: 1 }, include: { twin: true } });
        if (user?.twin) {
          await send(`you're already set up — ${user.twin.name} is your twin. just text normally.\n\n/reset to start over.`);
        } else {
          fs.writeFileSync(WAITING_FLAG, "1");
          await send(ONBOARDING_PROMPT);
        }
        processed++;
        continue;
      }

      // /reset
      if (text === "/reset") {
        if (fs.existsSync(WAITING_FLAG)) fs.unlinkSync(WAITING_FLAG);
        if (fs.existsSync(GENERATING_FLAG)) fs.unlinkSync(GENERATING_FLAG);
        fs.writeFileSync(WAITING_FLAG, "1");
        await send(ONBOARDING_PROMPT);
        processed++;
        continue;
      }

      if (text.startsWith("/")) continue;

      // If generating, ignore
      if (fs.existsSync(GENERATING_FLAG)) {
        await send("still generating your plan, hang on...");
        processed++;
        continue;
      }

      // If waiting for onboarding reply
      if (fs.existsSync(WAITING_FLAG)) {
        fs.unlinkSync(WAITING_FLAG);
        runGeneration(text); // fire and forget — don't await, let polling continue
        processed++;
        continue;
      }

      // Normal twin reply
      const user = await db.user.findUnique({
        where: { id: 1 },
        include: { twin: true, messages: { orderBy: { createdAt: "desc" }, take: 6 } },
      });

      if (!user?.twin) {
        await send("send /start to get set up first");
        processed++;
        continue;
      }

      await db.message.create({ data: { userId: 1, direction: "user_to_twin", body: text } });

      const conversation = user.messages
        .reverse()
        .map((m) => `${m.direction === "twin_to_user" ? user.twin!.name : "You"}: ${m.body}`)
        .join("\n");

      const prompt = fillTemplate(REPLY_PROMPT, {
        twinName: user.twin.name,
        personality: user.twin.personality,
        speechStyle: user.twin.speechStyle,
        conversation: conversation + `\nYou: ${text}`,
      });

      const reply = await generateReply(prompt);
      await db.message.create({ data: { userId: 1, direction: "twin_to_user", body: reply } });
      await send(reply);
      processed++;
    }

    return NextResponse.json({ processed, offset: lastOffset });
  } catch (err) {
    console.error("Poll error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
