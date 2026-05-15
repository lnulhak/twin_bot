import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePlan, generateTwin, generateReply, generateNudge, parseGoalStep, parseScheduleStep, parseTwinStep } from "@/lib/llm";
import { fillTemplate, REPLY_PROMPT, NUDGE_PRE_PROMPT, NUDGE_DURING_PROMPT, NUDGE_POST_PROMPT, MORNING_BRIEFING_PROMPT } from "@/lib/prompts";
import { sendMessage } from "@/lib/telegram";
import { getSession, saveSession, clearSession } from "@/lib/onboardingSession";
import type { OnboardingSession } from "@/lib/onboardingSession";
import fs from "node:fs";
import path from "node:path";

const OFFSET_FILE = path.resolve(process.cwd(), ".telegram-offset");

const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "805422072";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TIMEZONE = "Asia/Singapore";

function getDayNumber(planStartDate: string): number {
  if (!planStartDate) return 1;
  const start = new Date(planStartDate + "T00:00:00+08:00");
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
}

function planHasStarted(planStartDate: string): boolean {
  return getDayNumber(planStartDate) >= 1;
}

function nowInSGT() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Singapore" }));
}

function loadOffset(): number {
  try { return parseInt(fs.readFileSync(OFFSET_FILE, "utf-8")) || 0; } catch { return 0; }
}
function saveOffset(offset: number) {
  fs.writeFileSync(OFFSET_FILE, String(offset));
}

let lastOffset = loadOffset();

const send = (text: string) => sendMessage(text, CHAT_ID);

function buildConfirmation(s: OnboardingSession): string {
  const blocked = s.blockedTimes?.length
    ? s.blockedTimes.map((b) => `${b.label} ${b.startTime}–${b.endTime}`).join(", ")
    : "none";
  return `here's what i got:\n\ngoal: ${s.goal}\nwhy: ${s.whyItMatters}\ntimeline: ${s.timelineDays} days\nhours/day: ${s.dailyHours}h, ${s.wakeTime}–${s.sleepTime}\nblocked: ${blocked}\nlevel: ${s.currentLevel}\ntwin: ${s.twinName} — ${s.twinVibe}\n\nreply "yes" to build your plan, or tell me what to fix.`;
}

async function runGeneration(session: OnboardingSession) {
  saveSession({ ...session, step: "generating" });
  try {
    const input = {
      goal: session.goal!,
      whyItMatters: session.whyItMatters!,
      timelineDays: session.timelineDays!,
      dailyHours: session.dailyHours!,
      wakeTime: session.wakeTime!,
      sleepTime: session.sleepTime!,
      blockedTimes: session.blockedTimes ?? [],
      currentLevel: session.currentLevel!,
      twinName: session.twinName!,
      twinVibe: session.twinVibe!,
      timezone: TIMEZONE,
    };

    // Clear old data
    await db.block.deleteMany({});
    await db.message.deleteMany({});
    const twin = await db.twin.findUnique({ where: { userId: 1 } });
    if (twin) {
      await db.twinBlock.deleteMany({ where: { twinId: twin.id } });
      await db.twin.delete({ where: { userId: 1 } });
    }
    await db.user.deleteMany({});

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const planStartDate = tomorrow.toISOString().slice(0, 10);

    await db.user.create({
      data: {
        id: 1, goal: input.goal, whyItMatters: input.whyItMatters,
        timelineDays: input.timelineDays, dailyHours: input.dailyHours,
        wakeTime: input.wakeTime, sleepTime: input.sleepTime,
        blockedTimes: JSON.stringify(input.blockedTimes),
        currentLevel: input.currentLevel, timezone: input.timezone, planStartDate,
      },
    });

    await send(`building your ${input.timelineDays}-day plan...`);

    const blocks = await generatePlan(input);
    if (!blocks.length) throw new Error("plan generation returned 0 blocks — try /reset");

    await send(`plan ready. creating ${input.twinName}...`);

    const twinData = await generateTwin(input, blocks);

    // Expand twin blocks across full timeline (repeat week 1 template)
    const totalWeeks = Math.ceil(input.timelineDays / 7);
    const expandedTwinBlocks = [];
    for (let week = 0; week < totalWeeks; week++) {
      for (const tb of twinData.twinBlocks) {
        const dayNumber = tb.dayNumber + week * 7;
        if (dayNumber > input.timelineDays) continue;
        expandedTwinBlocks.push({ ...tb, dayNumber });
      }
    }

    await db.block.createMany({ data: blocks.map((b) => ({ userId: 1, ...b })) });
    const createdTwin = await db.twin.create({
      data: { userId: 1, name: input.twinName, personality: twinData.personality, speechStyle: twinData.speechStyle },
    });
    await db.twinBlock.createMany({
      data: expandedTwinBlocks.map((tb) => ({ twinId: createdTwin.id, ...tb })),
    });

    // Twin introduction
    const firstBlock = blocks.filter((b) => b.dayNumber === 1).sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    const firstTime = firstBlock?.startTime ?? input.wakeTime;
    await send(
      `meet ${input.twinName}.\n\n${twinData.personality}\n\ntexting style: "${twinData.speechStyle}"\n\nday 1 starts tomorrow at ${firstTime}. ${input.twinName} will nudge you before each block.\n\ntext ${input.twinName} anytime — they'll reply in character. /help for commands.`
    );

    clearSession();
  } catch (err) {
    console.error("Generation error:", err);
    const msg = err instanceof Error ? err.message : "unknown error";
    await send(`generation failed: ${msg}\n\nuse /reset to try again.`);
    clearSession();
  }
}

async function handleOnboarding(text: string): Promise<boolean> {
  const session = getSession();
  if (!session || session.step === "generating") return false;

  switch (session.step) {
    case "goal": {
      const parsed = await parseGoalStep(text);
      if (!parsed?.ok) {
        const missing = parsed?.missing.join(", ") ?? "goal, reason, and timeline";
        await send(`missing: ${missing}\n\ntry again — what's your goal, why does it matter, and how long? (30, 60, or 90 days)`);
        return true;
      }
      saveSession({ ...session, step: "schedule", goal: parsed.goal, whyItMatters: parsed.whyItMatters, timelineDays: parsed.timelineDays });
      await send(`got it — ${parsed.goal} in ${parsed.timelineDays} days.\n\nnow your schedule:\n• hours/day you can commit? (e.g. 2)\n• wake time / sleep time? (e.g. 07:30 / 23:00)\n• anything blocked out? (e.g. work 09:00–17:00, or none)`);
      return true;
    }

    case "schedule": {
      const parsed = await parseScheduleStep(text);
      if (!parsed?.ok) {
        await send(`need your daily hours and wake/sleep times — try again`);
        return true;
      }
      saveSession({ ...session, step: "twin", dailyHours: parsed.dailyHours, wakeTime: parsed.wakeTime, sleepTime: parsed.sleepTime, blockedTimes: parsed.blockedTimes });
      await send(`got it — ${parsed.dailyHours}h/day, ${parsed.wakeTime}–${parsed.sleepTime}.\n\nalmost done:\n• where are you starting from? (current level, background)\n• twin name?\n• their vibe? (e.g. chill but focused, lowercase)`);
      return true;
    }

    case "twin": {
      const parsed = await parseTwinStep(text);
      if (!parsed?.ok) {
        await send(`just need to know where you're starting from skill-wise — try again`);
        return true;
      }
      const updated = { ...session, step: "confirm" as const, currentLevel: parsed.currentLevel, twinName: parsed.twinName, twinVibe: parsed.twinVibe };
      saveSession(updated);
      await send(buildConfirmation(updated));
      return true;
    }

    case "confirm": {
      if (text.toLowerCase().startsWith("yes")) {
        const s = getSession()!;
        runGeneration(s); // fire and forget
        return true;
      }
      // User wants to fix something — parse all three and apply whichever succeed
      const [goalParsed, scheduleParsed, twinParsed] = await Promise.all([
        parseGoalStep(text).catch(() => null),
        parseScheduleStep(text).catch(() => null),
        parseTwinStep(text).catch(() => null),
      ]);
      const anyFixed = goalParsed?.ok || scheduleParsed?.ok || twinParsed?.ok;
      if (!anyFixed) {
        await send(`couldn't figure out what to change. reply "yes" to confirm as-is, or try something like "change goal to lose 10kg" or "change timeline to 60 days"`);
        return true;
      }
      const updated = {
        ...session,
        ...(goalParsed?.ok ? { goal: goalParsed.goal, whyItMatters: goalParsed.whyItMatters, timelineDays: goalParsed.timelineDays } : {}),
        ...(scheduleParsed?.ok ? { dailyHours: scheduleParsed.dailyHours, wakeTime: scheduleParsed.wakeTime, sleepTime: scheduleParsed.sleepTime, blockedTimes: scheduleParsed.blockedTimes } : {}),
        ...(twinParsed?.ok ? { currentLevel: twinParsed.currentLevel, twinName: twinParsed.twinName, twinVibe: twinParsed.twinVibe } : {}),
      };
      saveSession(updated);
      await send(buildConfirmation(updated));
      return true;
    }

    default:
      return false;
  }
}

async function handleMessage(text: string) {
  if (text === "/start") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { twin: true } });
    if (user?.twin) {
      await send(`you're already set up — ${user.twin.name} is your twin. just text normally.\n\n/reset to start over.`);
    } else {
      clearSession();
      saveSession({ step: "goal" });
      await send(`hey. let's get you set up in 3 quick messages.\n\nwhat's your goal, why does it matter, and how long do you want to work on it?\n\nexample: "get fit for a marathon in 90 days because i want to run my first race"`);
    }
    return;
  }

  if (text === "/reset") {
    clearSession();
    saveSession({ step: "goal" });
    await send(`starting over.\n\nwhat's your goal, why does it matter, and how long? (30, 60, or 90 days)`);
    return;
  }

  if (text === "/today") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start to get set up first"); return; }
    if (!planHasStarted(user.planStartDate)) { await send(`plan starts tomorrow — rest up`); return; }
    const dayNumber = getDayNumber(user.planStartDate);
    const blocks = user.blocks.filter((b) => b.dayNumber === dayNumber).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!blocks.length) { await send("no blocks today"); return; }
    const lines = blocks.map((b, i) => `${i + 1}. [${b.completed ? "x" : " "}] ${b.startTime} — ${b.description} (${b.durationMin}m)`);
    await send(`day ${dayNumber} of ${user.timelineDays}\n\n${lines.join("\n")}\n\n/done <n> to mark complete`);
    return;
  }

  if (text.startsWith("/done")) {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start first"); return; }
    if (!planHasStarted(user.planStartDate)) { await send(`plan starts tomorrow`); return; }
    const dayNumber = getDayNumber(user.planStartDate);
    const blocks = user.blocks.filter((b) => b.dayNumber === dayNumber).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const n = parseInt(text.split(" ")[1]);
    if (isNaN(n)) { await send("use /done followed by a number — e.g. /done 1\n\nuse /today to see today's blocks"); return; }
    const block = blocks[n - 1];
    if (!block) { await send(`no block #${n} today. use /today to see the list`); return; }

    // Can't mark done before the block has started
    const now = nowInSGT();
    const [bh, bm] = block.startTime.split(":").map(Number);
    const blockStart = new Date(now);
    blockStart.setHours(bh, bm, 0, 0);
    if (now < blockStart) {
      await send(`that block starts at ${block.startTime} — can't mark it done yet`);
      return;
    }

    await db.block.update({ where: { id: block.id }, data: { completed: true } });

    // Streak: all blocks on a day must be complete
    const freshBlocks = await db.block.findMany({ where: { userId: 1 } });
    let streak = 0;
    for (let d = dayNumber; d >= 1; d--) {
      const dayBlocks = freshBlocks.filter((b) => b.dayNumber === d);
      if (dayBlocks.length > 0 && dayBlocks.every((b) => b.completed)) streak++;
      else break;
    }
    const remaining = freshBlocks.filter((b) => b.dayNumber === dayNumber && !b.completed).length;
    const streakMsg = streak > 0 ? `\n\n🔥 ${streak} day streak` : "";
    const remainingMsg = remaining > 0 ? `\n${remaining} block${remaining > 1 ? "s" : ""} left today` : "\nall blocks done today";
    await send(`done: ${block.description}${remainingMsg}${streakMsg}`);
    return;
  }

  if (text === "/streak") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start first"); return; }
    if (!planHasStarted(user.planStartDate)) { await send(`no streak yet — plan starts tomorrow`); return; }
    const dayNumber = getDayNumber(user.planStartDate);
    let streak = 0;
    for (let d = dayNumber; d >= 1; d--) {
      const dayBlocks = user.blocks.filter((b) => b.dayNumber === d);
      if (dayBlocks.length > 0 && dayBlocks.every((b) => b.completed)) streak++;
      else break;
    }
    await send(`${streak} day streak — day ${dayNumber} of ${user.timelineDays}`);
    return;
  }

  if (text === "/twin") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { twin: { include: { blocks: true } } } });
    if (!user?.twin) { await send("send /start first"); return; }
    if (!planHasStarted(user.planStartDate)) { await send(`${user.twin.name} starts tomorrow — get some rest`); return; }
    const dayNumber = getDayNumber(user.planStartDate);
    const now = nowInSGT();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const twinBlocks = user.twin.blocks.filter((b) => b.dayNumber === dayNumber)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (!twinBlocks.length) { await send(`no blocks for ${user.twin.name} today`); return; }

    const firstBlock = twinBlocks[0];
    const [fh, fm] = firstBlock.startTime.split(":").map(Number);
    if (nowMin < fh * 60 + fm) {
      await send(`${user.twin.name} hasn't started yet. first block at ${firstBlock.startTime} — ${firstBlock.description}`);
      return;
    }

    const current = twinBlocks.find((b) => {
      const [h, m] = b.startTime.split(":").map(Number);
      const start = h * 60 + m;
      return nowMin >= start && nowMin < start + b.durationMin;
    });
    if (current) {
      await send(`${user.twin.name} is on: ${current.description}\n\n"${current.vibe}"`);
      return;
    }

    const next = twinBlocks.find((b) => {
      const [h, m] = b.startTime.split(":").map(Number);
      return h * 60 + m > nowMin;
    });
    if (next) {
      await send(`${user.twin.name} is on a break. next up at ${next.startTime} — ${next.description}`);
    } else {
      const tomorrow = twinBlocks[0];
      await send(`${user.twin.name} is done for today. back at ${tomorrow.startTime} tomorrow`);
    }
    return;
  }

  if (text === "/plan") {
    const user = await db.user.findUnique({ where: { id: 1 }, include: { blocks: true } });
    if (!user) { await send("send /start first"); return; }
    const dayNumber = getDayNumber(user.planStartDate);
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

  // Handle onboarding steps
  const session = getSession();
  if (session && session.step !== "generating") {
    await handleOnboarding(text);
    return;
  }
  if (session?.step === "generating") {
    await send("still generating your plan, hang on...");
    return;
  }

  // Normal twin reply
  const user = await db.user.findUnique({
    where: { id: 1 },
    include: { twin: true, messages: { orderBy: { createdAt: "desc" }, take: 6 } },
  });

  if (!user?.twin) { await send("send /start to get set up first"); return; }

  // Plan complete
  const dayNum = getDayNumber(user.planStartDate);
  if (dayNum > user.timelineDays) {
    await send(`you finished your ${user.timelineDays}-day plan. ${user.twin.name} made it too.\n\nuse /reset to start a new one.`);
    return;
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
}

async function checkNudges() {
  const user = await db.user.findUnique({
    where: { id: 1 },
    include: {
      twin: { include: { blocks: true } },
      blocks: true,
      messages: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!user?.twin) return;

  const now = nowInSGT();
  const dayNumber = getDayNumber(user.planStartDate);

  // Plan complete — fire one-time completion message
  if (dayNumber > user.timelineDays) {
    const alreadySent = user.messages.some((m) => m.nudgeType === "complete");
    if (!alreadySent) {
      const msg = `${user.timelineDays} days. done.\n\n${user.twin.name} made it through every block. so did you.\n\nuse /reset to start a new goal.`;
      await db.message.create({ data: { userId: 1, direction: "twin_to_user", body: msg, nudgeType: "complete" } });
      await send(msg);
    }
    return;
  }

  const todayBlocks = user.blocks.filter((b) => b.dayNumber === dayNumber);

  const recentMessages = [...user.messages].reverse()
    .map((msg) => `${msg.direction === "twin_to_user" ? user.twin!.name : "You"}: ${msg.body}`)
    .join("\n") || "(no prior messages)";

  // Morning briefing at wake time
  const [wh, wm] = user.wakeTime.split(":").map(Number);
  const wakeDate = new Date(now);
  wakeDate.setHours(wh, wm, 0, 0);
  const secsToWake = (now.getTime() - wakeDate.getTime()) / 1000;
  const alreadyBriefed = user.messages.some(
    (msg) => msg.nudgeType === "morning" && new Date(msg.createdAt).toDateString() === now.toDateString()
  );

  if (secsToWake >= 0 && secsToWake <= 60 && !alreadyBriefed && todayBlocks.length > 0) {
    const blockSummary = todayBlocks
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((b) => `${b.startTime} — ${b.description} (${b.durationMin}m)`)
      .join("\n");

    const msg = await generateNudge(fillTemplate(MORNING_BRIEFING_PROMPT, {
      twinName: user.twin.name,
      personality: user.twin.personality,
      speechStyle: user.twin.speechStyle,
      todayBlocks: blockSummary,
    }));
    await db.message.create({ data: { userId: 1, direction: "twin_to_user", body: msg, nudgeType: "morning" } });
    await send(msg);
  }

  for (const block of todayBlocks) {
    const [h, m] = block.startTime.split(":").map(Number);
    const blockStart = new Date(now);
    blockStart.setHours(h, m, 0, 0);
    const blockEnd = new Date(blockStart.getTime() + block.durationMin * 60 * 1000);

    const secsToStart = (blockStart.getTime() - now.getTime()) / 1000;
    const secsSinceStart = (now.getTime() - blockStart.getTime()) / 1000;
    const secsSinceEnd = (now.getTime() - blockEnd.getTime()) / 1000;

    const twinBlock = user.twin.blocks.find(
      (tb) => tb.dayNumber === block.dayNumber && tb.type === block.type
    ) ?? user.twin.blocks.find((tb) => tb.type === block.type) ?? user.twin.blocks[0];

    const base = {
      twinName: user.twin.name,
      personality: user.twin.personality,
      speechStyle: user.twin.speechStyle,
      blockDescription: block.description,
      durationMin: block.durationMin,
      blockVibe: twinBlock?.vibe ?? "focused",
      recentMessages,
    };

    // Race condition guard: check DB fresh before each nudge type
    async function shouldSendNudge(nudgeType: string): Promise<boolean> {
      const existing = await db.message.findFirst({
        where: { blockRef: block.id, direction: "twin_to_user", nudgeType },
      });
      return !existing;
    }

    // 1. Pre-nudge: fires within 60s window starting at T-10min
    if (secsToStart >= 0 && secsToStart <= 600 && secsToStart >= 540 && await shouldSendNudge("pre")) {
      const msg = await generateNudge(fillTemplate(NUDGE_PRE_PROMPT, base));
      await db.message.create({ data: { userId: 1, direction: "twin_to_user", body: msg, blockRef: block.id, nudgeType: "pre" } });
      await send(msg);
    }

    // 2. During-nudge: at block start (fire within a 60s window)
    if (secsSinceStart >= 0 && secsSinceStart <= 60 && await shouldSendNudge("during")) {
      const msg = await generateNudge(fillTemplate(NUDGE_DURING_PROMPT, base));
      await db.message.create({ data: { userId: 1, direction: "twin_to_user", body: msg, blockRef: block.id, nudgeType: "during" } });
      await send(msg);
    }

    // 3. Post-nudge: at block end (fire within a 60s window)
    if (secsSinceEnd >= 0 && secsSinceEnd <= 60 && await shouldSendNudge("post")) {
      const msg = await generateNudge(fillTemplate(NUDGE_POST_PROMPT, base));
      await db.message.create({ data: { userId: 1, direction: "twin_to_user", body: msg, blockRef: block.id, nudgeType: "post" } });
      await send(msg);
    }
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
    saveOffset(lastOffset);

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
