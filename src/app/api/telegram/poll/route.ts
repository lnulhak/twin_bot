import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePlan, generateTwin, generateReply, generateNudge, parseOnboardingReply, validateOnboardingReply } from "@/lib/llm";
import { fillTemplate, REPLY_PROMPT, NUDGE_PROMPT } from "@/lib/prompts";
import { sendMessage } from "@/lib/telegram";
import { startOfDay } from "date-fns";
import fs from "node:fs";
import path from "node:path";

const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "805422072";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TIMEZONE = "Asia/Singapore";

const WAITING_FLAG = path.resolve(process.cwd(), ".onboarding-waiting");
const GENERATING_FLAG = path.resolve(process.cwd(), ".onboarding-generating");

let lastOffset = 0;

const send = (text: string) => sendMessage(text, CHAT_ID);

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
  // Validate before generating
  const validation = await validateOnboardingReply(userReply);
  if (!validation.complete) {
    fs.writeFileSync(WAITING_FLAG, "1");
    const missing = validation.missing.join(", ");
    await send(`need a bit more — missing: ${missing}\n\ntry again with all the details.`);
    return;
  }

  fs.writeFileSync(GENERATING_FLAG, "1");
  try {
    await send("parsing your answers and generating the plan...");

    const parsed = await parseOnboardingReply(userReply, TIMEZONE);
    if (!parsed) throw new Error("Failed to parse");
    const input = { ...parsed, timezone: TIMEZONE };

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
      data: { userId: 1, name: input.twinName, personality: twinData.personality, speechStyle: twinData.speechStyle },
    });
    await db.twinBlock.createMany({
      data: twinData.twinBlocks.map((tb) => ({ twinId: createdTwin.id, ...tb })),
    });

    await send(`done. ${input.twinName} is ready.\n\nshe'll nudge you when your first block starts. text her anytime.\n\n/help for commands.`);
  } catch (err) {
    console.error("Generation error:", err);
    await send("something went wrong. try /start again");
  } finally {
    if (fs.existsSync(WAITING_FLAG)) fs.unlinkSync(WAITING_FLAG);
    if (fs.existsSync(GENERATING_FLAG)) fs.unlinkSync(GENERATING_FLAG);
  }
}

async function handleMessage(text: string) {
  if (text === "/start") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { twin: true } });
    if (user?.twin) {
      await send(`you're already set up — ${user.twin.name} is your twin. just text normally.\n\n/reset to start over.`);
    } else {
      fs.writeFileSync(WAITING_FLAG, "1");
      await send(ONBOARDING_PROMPT);
    }
    return;
  }

  if (text === "/reset") {
    if (fs.existsSync(WAITING_FLAG)) fs.unlinkSync(WAITING_FLAG);
    if (fs.existsSync(GENERATING_FLAG)) fs.unlinkSync(GENERATING_FLAG);
    fs.writeFileSync(WAITING_FLAG, "1");
    await send(ONBOARDING_PROMPT);
    return;
  }

  if (text === "/today") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start to get set up first"); return; }
    const dayNumber = Math.floor((startOfDay(new Date()).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
    const blocks = user.blocks.filter((b) => b.dayNumber === dayNumber).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!blocks.length) { await send("no blocks today"); return; }
    const lines = blocks.map((b, i) => `${i + 1}. [${b.completed ? "x" : " "}] ${b.startTime} — ${b.description} (${b.durationMin}m)`);
    await send(`day ${dayNumber} of ${user.timelineDays}\n\n${lines.join("\n")}\n\n/done <n> to mark complete`);
    return;
  }

  if (text.startsWith("/done")) {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start first"); return; }
    const dayNumber = Math.floor((startOfDay(new Date()).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
    const blocks = user.blocks.filter((b) => b.dayNumber === dayNumber).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const n = parseInt(text.split(" ")[1]);
    const block = blocks[n - 1];
    if (!block) { await send("invalid number. use /today to see the list"); return; }
    await db.block.update({ where: { id: block.id }, data: { completed: true } });
    let streak = 0;
    for (let d = dayNumber; d >= 1; d--) {
      const dayBlocks = user.blocks.filter((b) => b.dayNumber === d);
      if (dayBlocks.some((b) => b.completed || b.id === block.id)) streak++;
      else break;
    }
    await send(`done: ${block.description}\n\n🔥 ${streak} day streak`);
    return;
  }

  if (text === "/streak") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start first"); return; }
    const dayNumber = Math.floor((startOfDay(new Date()).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
    let streak = 0;
    for (let d = dayNumber; d >= 1; d--) {
      if (user.blocks.filter((b) => b.dayNumber === d).some((b) => b.completed)) streak++;
      else break;
    }
    await send(`${streak} day streak — day ${dayNumber} of ${user.timelineDays}`);
    return;
  }

  if (text === "/twin") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { twin: { include: { blocks: true } } } });
    if (!user?.twin) { await send("send /start first"); return; }
    const dayNumber = Math.floor((startOfDay(new Date()).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const twinBlocks = user.twin.blocks.filter((b) => b.dayNumber === dayNumber);
    const current = twinBlocks.find((b) => {
      const [h, m] = b.startTime.split(":").map(Number);
      const start = h * 60 + m;
      return nowMin >= start && nowMin < start + b.durationMin;
    });
    if (current) {
      await send(`${user.twin.name} is on: ${current.description}\n\n"${current.vibe}"`);
    } else {
      const next = twinBlocks.find((b) => { const [h, m] = b.startTime.split(":").map(Number); return h * 60 + m > nowMin; });
      await send(next ? `${user.twin.name}'s next: ${next.startTime} — ${next.description}` : `${user.twin.name} is done for today`);
    }
    return;
  }

  if (text === "/plan") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start first"); return; }
    const dayNumber = Math.floor((startOfDay(new Date()).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
    const days = [0,1,2,3,4,5,6].map((o) => dayNumber + o).filter((d) => d <= user.timelineDays);
    const lines = days.map((d) => {
      const dayBlocks = user.blocks.filter((b) => b.dayNumber === d);
      const done = dayBlocks.filter((b) => b.completed).length;
      return `${d === dayNumber ? "today" : `day ${d}`}: ${dayBlocks.length} blocks${done > 0 ? ` (${done} done)` : ""}`;
    });
    await send(`${user.goal}\n\n${lines.join("\n")}\n\n${user.timelineDays - dayNumber + 1} days left`);
    return;
  }

  if (text === "/help") {
    await send("/today — today's blocks\n/done <n> — mark block complete\n/streak — current streak\n/twin — what your twin is doing now\n/plan — this week's overview\n/reset — start over");
    return;
  }

  if (text.startsWith("/")) return;

  if (fs.existsSync(GENERATING_FLAG)) {
    await send("still generating your plan, hang on...");
    return;
  }

  if (fs.existsSync(WAITING_FLAG)) {
    fs.unlinkSync(WAITING_FLAG);
    runGeneration(text);
    return;
  }

  // Normal twin reply
  const user = await db.user.findUnique({
    where: { id: 1 },
    include: { twin: true, messages: { orderBy: { createdAt: "desc" }, take: 6 } },
  });

  if (!user?.twin) { await send("send /start to get set up first"); return; }

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
}

async function checkNudges() {
  const user = await db.user.findUnique({
    where: { id: 1 },
    include: {
      twin: { include: { blocks: true } },
      blocks: true,
      messages: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });
  if (!user?.twin) return;

  const now = new Date();
  const dayNumber = Math.floor((startOfDay(now).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
  const todayBlocks = user.blocks.filter((b) => b.dayNumber === dayNumber);

  for (const block of todayBlocks) {
    const [h, m] = block.startTime.split(":").map(Number);
    const blockDate = new Date(startOfDay(now));
    blockDate.setHours(h, m, 0, 0);
    const secsSinceStart = (now.getTime() - blockDate.getTime()) / 1000;

    // Fire nudge if block started within the last 60 seconds and hasn't been nudged yet
    if (secsSinceStart < 0 || secsSinceStart >= 60) continue;
    const alreadyNudged = user.messages.some((msg) => msg.blockRef === block.id && msg.direction === "twin_to_user");
    if (alreadyNudged) continue;

    const twinBlock = user.twin.blocks.find(
      (tb) => tb.dayNumber === block.dayNumber && tb.type === block.type
    ) ?? user.twin.blocks[0];

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const blockStartMinutes = h * 60 + m;
    const minutesIn = Math.max(0, nowMinutes - blockStartMinutes);

    const recentMessages = user.messages
      .reverse()
      .map((msg) => `${msg.direction === "twin_to_user" ? user.twin!.name : "You"}: ${msg.body}`)
      .join("\n");

    const prompt = fillTemplate(NUDGE_PROMPT, {
      twinName: user.twin.name,
      personality: user.twin.personality,
      speechStyle: user.twin.speechStyle,
      blockType: twinBlock.type,
      blockDescription: twinBlock.description,
      blockVibe: twinBlock.vibe,
      blockStartTime: twinBlock.startTime,
      minutesIn,
      userBlockDescription: block.description,
      minutesUntilUserBlock: Math.max(0, blockStartMinutes - nowMinutes + 10),
      recentMessages: recentMessages || "(no prior messages)",
    });

    const message = await generateNudge(prompt);
    await db.message.create({ data: { userId: 1, direction: "twin_to_user", body: message, blockRef: block.id } });
    await send(message);
  }
}

export async function POST() {
  if (!BOT_TOKEN) return NextResponse.json({ error: "no token" }, { status: 500 });

  try {
    // Check if any blocks need nudges
    await checkNudges().catch((err) => console.error("Nudge check error:", err));

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
      await handleMessage(msg.text.trim());
      processed++;
    }

    return NextResponse.json({ processed, offset: lastOffset });
  } catch (err) {
    console.error("Poll error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
