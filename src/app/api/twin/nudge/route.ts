import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateNudge } from "@/lib/llm";
import { fillTemplate, NUDGE_PROMPT } from "@/lib/prompts";
import { sendMessage } from "@/lib/telegram";

const NudgeSchema = z.object({ blockId: z.number() });

export async function POST(req: NextRequest) {
  try {
    const { blockId } = NudgeSchema.parse(await req.json());

    const user = await db.user.findUnique({
      where: { id: 1 },
      include: {
        twin: { include: { blocks: true } },
        blocks: true,
        messages: { orderBy: { createdAt: "desc" }, take: 6 },
      },
    });

    if (!user?.twin) {
      return NextResponse.json({ error: "No twin found" }, { status: 404 });
    }

    // Find the corresponding twin block
    const userBlock = user.blocks.find((b) => b.id === blockId);
    if (!userBlock) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    const twinBlock = user.twin.blocks.find(
      (tb) => tb.dayNumber === userBlock.dayNumber && tb.type === userBlock.type
    ) ?? user.twin.blocks[0];

    // Figure out how far into the block the twin is
    const now = new Date();
    const [h, m] = twinBlock.startTime.split(":").map(Number);
    const blockStartMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const minutesIn = Math.max(0, nowMinutes - blockStartMinutes);

    const recentMessages = user.messages
      .reverse()
      .map((msg) => `${msg.direction === "twin_to_user" ? user.twin!.name : "User"}: ${msg.body}`)
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
      userBlockDescription: userBlock.description,
      minutesUntilUserBlock: Math.max(0, blockStartMinutes - nowMinutes + 10),
      recentMessages: recentMessages || "(no prior messages)",
    });

    const message = await generateNudge(prompt);

    await db.message.create({
      data: { userId: 1, direction: "twin_to_user", body: message, blockRef: blockId },
    });

    // Send directly to Telegram
    await sendMessage(message);

    return NextResponse.json({ message });
  } catch (err) {
    console.error("Nudge error:", err);
    return NextResponse.json({ error: "Failed to generate nudge" }, { status: 500 });
  }
}
