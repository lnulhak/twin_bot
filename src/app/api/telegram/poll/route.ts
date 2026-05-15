import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateReply } from "@/lib/llm";
import { fillTemplate, REPLY_PROMPT } from "@/lib/prompts";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = "805422072";
const OFFSET_KEY = "telegram_poll_offset";

// Simple in-memory offset (resets on server restart, but that's fine for dev)
let lastOffset = 0;

export async function POST() {
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  try {
    // Fetch new updates from Telegram
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastOffset + 1}&timeout=0&limit=10`
    );
    const data = await res.json();

    if (!data.ok || !data.result?.length) {
      return NextResponse.json({ processed: 0 });
    }

    const updates = data.result;
    lastOffset = updates[updates.length - 1].update_id;

    const user = await db.user.findUnique({
      where: { id: 1 },
      include: { twin: true, messages: { orderBy: { createdAt: "desc" }, take: 6 } },
    });

    if (!user?.twin) {
      return NextResponse.json({ processed: 0, reason: "no user/twin" });
    }

    let processed = 0;
    for (const update of updates) {
      const msg = update.message;
      if (!msg?.text || String(msg.chat.id) !== TELEGRAM_CHAT_ID) continue;

      // Handle /start
      if (msg.text === "/start") {
        const hasUser = await db.user.findUnique({ where: { id: 1 } });
        const greeting = hasUser
          ? `hey, ${user.twin?.name ?? "your twin"} is already set up. open the dashboard: http://localhost:3001`
          : `hey. to get started, open the app and complete onboarding: http://localhost:3001`;
        await execAsync(
          `openclaw message send --channel telegram --target ${TELEGRAM_CHAT_ID} -m ${JSON.stringify(greeting)}`
        );
        continue;
      }

      // Skip other commands
      if (msg.text.startsWith("/")) continue;

      const body = msg.text;

      // Persist user message
      await db.message.create({ data: { userId: 1, direction: "user_to_twin", body } });

      // Build conversation context
      const conversation = user.messages
        .reverse()
        .map((m) => `${m.direction === "twin_to_user" ? user.twin!.name : "You"}: ${m.body}`)
        .join("\n");

      const prompt = fillTemplate(REPLY_PROMPT, {
        twinName: user.twin.name,
        personality: user.twin.personality,
        speechStyle: user.twin.speechStyle,
        conversation: conversation + `\nYou: ${body}`,
      });

      const reply = await generateReply(prompt);

      // Persist twin reply
      await db.message.create({ data: { userId: 1, direction: "twin_to_user", body: reply } });

      // Send via OpenClaw
      await execAsync(
        `openclaw message send --channel telegram --target ${TELEGRAM_CHAT_ID} -m ${JSON.stringify(reply)}`
      );

      processed++;
    }

    return NextResponse.json({ processed, offset: lastOffset });
  } catch (err) {
    console.error("Telegram poll error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
