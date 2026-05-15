import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePlan, generateTwin, generateReply, parseOnboardingReply } from "@/lib/llm";
import { fillTemplate, REPLY_PROMPT } from "@/lib/prompts";
import { scheduleNudge } from "@/lib/openclaw";
import { sendMessage } from "@/lib/telegram";
import { format, startOfDay } from "date-fns";
import fs from "node:fs";
import path from "node:path";

const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "805422072";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const TIMEZONE = "Asia/Singapore";

const WAITING_FLAG = path.resolve(process.cwd(), ".onboarding-waiting");
const GENERATING_FLAG = path.resolve(process.cwd(), ".onboarding-generating");

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

    await send(`done. ${input.twinName} is ready.\n\nshe'll nudge you at your first block. text her anytime.\n\n/help for commands.`);
  } catch (err) {
    console.error("Generation error:", err);
    await send("something went wrong generating the plan. try /start again");
  } finally {
    if (fs.existsSync(WAITING_FLAG)) fs.unlinkSync(WAITING_FLAG);
    if (fs.existsSync(GENERATING_FLAG)) fs.unlinkSync(GENERATING_FLAG);
  }
}

export async function POST(req: NextRequest) {
  // Verify webhook secret
  if (WEBHOOK_SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const msg = body?.message;
  if (!msg?.text || String(msg.chat.id) !== CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

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
    return NextResponse.json({ ok: true });
  }

  // /reset
  if (text === "/reset") {
    if (fs.existsSync(WAITING_FLAG)) fs.unlinkSync(WAITING_FLAG);
    if (fs.existsSync(GENERATING_FLAG)) fs.unlinkSync(GENERATING_FLAG);
    fs.writeFileSync(WAITING_FLAG, "1");
    await send(ONBOARDING_PROMPT);
    return NextResponse.json({ ok: true });
  }

  // /today
  if (text === "/today") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start to get set up first"); return NextResponse.json({ ok: true }); }
    const dayNumber = Math.floor((startOfDay(new Date()).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
    const blocks = user.blocks.filter((b) => b.dayNumber === dayNumber).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!blocks.length) { await send("no blocks today"); return NextResponse.json({ ok: true }); }
    const lines = blocks.map((b, i) => `${i + 1}. [${b.completed ? "x" : " "}] ${b.startTime} — ${b.description} (${b.durationMin}m)`);
    await send(`day ${dayNumber} of ${user.timelineDays}\n\n${lines.join("\n")}\n\n/done <n> to mark complete`);
    return NextResponse.json({ ok: true });
  }

  // /done <n>
  if (text.startsWith("/done")) {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start first"); return NextResponse.json({ ok: true }); }
    const dayNumber = Math.floor((startOfDay(new Date()).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
    const blocks = user.blocks.filter((b) => b.dayNumber === dayNumber).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const n = parseInt(text.split(" ")[1]);
    const block = blocks[n - 1];
    if (!block) { await send("invalid number. use /today to see the list"); return NextResponse.json({ ok: true }); }
    await db.block.update({ where: { id: block.id }, data: { completed: true } });
    let streak = 0;
    for (let d = dayNumber; d >= 1; d--) {
      const dayBlocks = user.blocks.filter((b) => b.dayNumber === d);
      if (dayBlocks.some((b) => b.completed || b.id === block.id)) streak++;
      else break;
    }
    await send(`done: ${block.description}\n\n🔥 ${streak} day streak`);
    return NextResponse.json({ ok: true });
  }

  // /streak
  if (text === "/streak") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start first"); return NextResponse.json({ ok: true }); }
    const dayNumber = Math.floor((startOfDay(new Date()).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
    let streak = 0;
    for (let d = dayNumber; d >= 1; d--) {
      if (user.blocks.filter((b) => b.dayNumber === d).some((b) => b.completed)) streak++;
      else break;
    }
    await send(`${streak} day streak — day ${dayNumber} of ${user.timelineDays}`);
    return NextResponse.json({ ok: true });
  }

  // /twin
  if (text === "/twin") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { twin: { include: { blocks: true } } } });
    if (!user?.twin) { await send("send /start first"); return NextResponse.json({ ok: true }); }
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
    return NextResponse.json({ ok: true });
  }

  // /plan
  if (text === "/plan") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start first"); return NextResponse.json({ ok: true }); }
    const dayNumber = Math.floor((startOfDay(new Date()).getTime() - startOfDay(new Date(user.createdAt)).getTime()) / 86400000) + 1;
    const days = [0,1,2,3,4,5,6].map((o) => dayNumber + o).filter((d) => d <= user.timelineDays);
    const lines = days.map((d) => {
      const dayBlocks = user.blocks.filter((b) => b.dayNumber === d);
      const done = dayBlocks.filter((b) => b.completed).length;
      return `${d === dayNumber ? "today" : `day ${d}`}: ${dayBlocks.length} blocks${done > 0 ? ` (${done} done)` : ""}`;
    });
    await send(`${user.goal}\n\n${lines.join("\n")}\n\n${user.timelineDays - dayNumber + 1} days left`);
    return NextResponse.json({ ok: true });
  }

  // /help
  if (text === "/help") {
    await send("/today — today's blocks\n/done <n> — mark block complete\n/streak — current streak\n/twin — what your twin is doing now\n/plan — this week's overview\n/reset — start over");
    return NextResponse.json({ ok: true });
  }

  // Skip other commands
  if (text.startsWith("/")) return NextResponse.json({ ok: true });

  // Generating in progress
  if (fs.existsSync(GENERATING_FLAG)) {
    await send("still generating your plan, hang on...");
    return NextResponse.json({ ok: true });
  }

  // Waiting for onboarding reply
  if (fs.existsSync(WAITING_FLAG)) {
    fs.unlinkSync(WAITING_FLAG);
    runGeneration(text); // fire and forget
    return NextResponse.json({ ok: true });
  }

  // Normal twin reply
  const user = await db.user.findUnique({
    where: { id: 1 },
    include: { twin: true, messages: { orderBy: { createdAt: "desc" }, take: 6 } },
  });

  if (!user?.twin) {
    await send("send /start to get set up first");
    return NextResponse.json({ ok: true });
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

  return NextResponse.json({ ok: true });
}
