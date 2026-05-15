import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePlan, generateTwin, generateReply } from "@/lib/llm";
import { fillTemplate, REPLY_PROMPT } from "@/lib/prompts";
import { scheduleNudge } from "@/lib/openclaw";
import { getSession, saveSession, clearSession } from "@/lib/onboardingSession";
import { format, addDays, startOfDay } from "date-fns";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "805422072";

let lastOffset = 0;

async function send(text: string) {
  await execAsync(
    `openclaw message send --channel telegram --target ${CHAT_ID} -m ${JSON.stringify(text)}`
  );
}

async function handleOnboarding(text: string): Promise<boolean> {
  const session = getSession();
  if (!session) return false;

  switch (session.step) {
    case "goal":
      saveSession({ ...session, step: "why", goal: text });
      await send("why does it matter to you?");
      return true;

    case "why":
      saveSession({ ...session, step: "timeline", whyItMatters: text });
      await send("timeline — reply 30, 60, or 90 days");
      return true;

    case "timeline": {
      const days = parseInt(text.trim());
      if (![30, 60, 90].includes(days)) {
        await send("reply with 30, 60, or 90");
        return true;
      }
      saveSession({ ...session, step: "hours", timelineDays: days as 30 | 60 | 90 });
      await send("how many hours per day can you commit? (1–8)");
      return true;
    }

    case "hours": {
      const hours = parseFloat(text.trim());
      if (isNaN(hours) || hours < 1 || hours > 8) {
        await send("enter a number between 1 and 8");
        return true;
      }
      saveSession({ ...session, step: "wake", dailyHours: hours });
      await send("wake time? (24h format, e.g. 07:30)");
      return true;
    }

    case "wake": {
      if (!/^\d{2}:\d{2}$/.test(text.trim())) {
        await send("use HH:MM format, e.g. 07:30");
        return true;
      }
      saveSession({ ...session, step: "sleep", wakeTime: text.trim() });
      await send("sleep time? (e.g. 23:00)");
      return true;
    }

    case "sleep": {
      if (!/^\d{2}:\d{2}$/.test(text.trim())) {
        await send("use HH:MM format, e.g. 23:00");
        return true;
      }
      saveSession({ ...session, step: "blocked", sleepTime: text.trim() });
      await send(
        "any times to block out? (e.g. \"Work 09:00-17:00\")\nreply \"none\" to skip"
      );
      return true;
    }

    case "blocked": {
      const blockedTimes = [];
      if (text.trim().toLowerCase() !== "none") {
        const match = text.match(/(.+?)\s+(\d{2}:\d{2})-(\d{2}:\d{2})/);
        if (match) {
          blockedTimes.push({ label: match[1].trim(), startTime: match[2], endTime: match[3] });
        }
      }
      saveSession({ ...session, step: "level", blockedTimes });
      await send("where are you starting from? (skill level, current fitness, background — be honest)");
      return true;
    }

    case "level":
      saveSession({ ...session, step: "twin_name", currentLevel: text });
      await send("give your twin a name (or pick one: Mira, Kai, Zoe)");
      return true;

    case "twin_name":
      saveSession({ ...session, step: "twin_vibe", twinName: text.trim() });
      await send(`what's ${text.trim()}'s vibe? (e.g. "chill but disciplined, lowercase texter")`);
      return true;

    case "twin_vibe": {
      const final = { ...session, step: "generating" as const, twinVibe: text.trim() };
      saveSession(final);
      await send(`got it. generating your plan and ${final.twinName}'s schedule — give me ~20 seconds`);

      // Run generation async
      generatePlanAndTwin(final).catch(async (err) => {
        console.error("Generation failed:", err);
        await send("something went wrong generating the plan. try /start again");
        clearSession();
      });
      return true;
    }

    default:
      return false;
  }
}

async function generatePlanAndTwin(session: ReturnType<typeof getSession> & object) {
  const s = session as Required<typeof session>;
  const input = {
    goal: s.goal,
    whyItMatters: s.whyItMatters,
    timelineDays: s.timelineDays,
    dailyHours: s.dailyHours,
    wakeTime: s.wakeTime,
    sleepTime: s.sleepTime,
    blockedTimes: s.blockedTimes ?? [],
    currentLevel: s.currentLevel,
    timezone: s.timezone,
    twinName: s.twinName,
    twinVibe: s.twinVibe,
  };

  // Clear old data
  await db.block.deleteMany({ where: { userId: 1 } });
  await db.message.deleteMany({ where: { userId: 1 } });
  const existingTwin = await db.twin.findUnique({ where: { userId: 1 } });
  if (existingTwin) {
    await db.twinBlock.deleteMany({ where: { twinId: existingTwin.id } });
    await db.twin.delete({ where: { userId: 1 } });
  }

  await db.user.upsert({
    where: { id: 1 },
    update: { ...input, blockedTimes: JSON.stringify(input.blockedTimes) },
    create: { id: 1, ...input, blockedTimes: JSON.stringify(input.blockedTimes) },
  });

  const blocks = await generatePlan(input);
  const twin = await generateTwin(input, blocks);

  await db.block.createMany({
    data: blocks.map((b) => ({ userId: 1, ...b })),
  });

  const createdTwin = await db.twin.create({
    data: { userId: 1, name: input.twinName, personality: twin.personality, speechStyle: twin.speechStyle },
  });

  await db.twinBlock.createMany({
    data: twin.twinBlocks.map((tb) => ({ twinId: createdTwin.id, ...tb })),
  });

  // Schedule today's future blocks
  const now = new Date();
  const startDate = startOfDay(now);
  for (const block of blocks.filter((b) => b.dayNumber === 1)) {
    const [h, m] = block.startTime.split(":").map(Number);
    const blockDate = new Date(startDate);
    blockDate.setHours(h, m, 0, 0);
    if (blockDate <= now) continue;
    const isoTime = format(blockDate, "yyyy-MM-dd'T'HH:mm:ss");
    const persisted = await db.block.findFirst({ where: { userId: 1, dayNumber: 1, startTime: block.startTime } });
    if (persisted) {
      try { await scheduleNudge(persisted.id, isoTime, input.timezone); } catch { /* best effort */ }
    }
  }

  clearSession();
  saveSession({ step: "done", timezone: input.timezone });

  await send(
    `done. ${input.twinName} is set up and ready.\n\nher first nudge fires at your first block today. you can see the full plan at http://localhost:3001/dashboard\n\njust text here normally to talk to ${input.twinName}.`
  );
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

      // /start — begin or restart onboarding
      if (text === "/start") {
        clearSession();
        const user = await db.user.findUnique({ where: { id: 1 }, include: { twin: true } });
        if (user?.twin) {
          await send(
            `you're already set up. ${user.twin.name} is your twin.\n\njust text normally to talk to her, or reply /reset to start over.`
          );
        } else {
          saveSession({ step: "goal", timezone: "Asia/Singapore", blockedTimes: [] });
          await send("hey. let's get you set up.\n\nwhat's your goal?");
        }
        processed++;
        continue;
      }

      // /reset — wipe and restart
      if (text === "/reset") {
        clearSession();
        await db.message.deleteMany({});
        await db.twinBlock.deleteMany({});
        await db.block.deleteMany({});
        await db.twin.deleteMany({});
        await db.user.deleteMany({});
        saveSession({ step: "goal", timezone: "Asia/Singapore", blockedTimes: [] });
        await send("reset. starting fresh.\n\nwhat's your goal?");
        processed++;
        continue;
      }

      // Skip other commands
      if (text.startsWith("/")) continue;

      // Check if onboarding is in progress
      const session = getSession();
      if (session && session.step !== "done" && session.step !== "generating") {
        const handled = await handleOnboarding(text);
        if (handled) { processed++; continue; }
      }

      // Normal reply to twin
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
