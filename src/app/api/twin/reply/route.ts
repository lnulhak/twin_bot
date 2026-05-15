import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateReply } from "@/lib/llm";
import { fillTemplate, REPLY_PROMPT } from "@/lib/prompts";

const ReplySchema = z.object({ body: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const { body } = ReplySchema.parse(await req.json());

    const user = await db.user.findUnique({
      where: { id: 1 },
      include: {
        twin: true,
        messages: { orderBy: { createdAt: "desc" }, take: 6 },
      },
    });

    if (!user?.twin) {
      return NextResponse.json({ error: "No twin found" }, { status: 404 });
    }

    // Persist user's message
    await db.message.create({
      data: { userId: 1, direction: "user_to_twin", body },
    });

    // Build conversation context
    const conversation = user.messages
      .reverse()
      .map((msg) => `${msg.direction === "twin_to_user" ? user.twin!.name : "You"}: ${msg.body}`)
      .join("\n");

    const prompt = fillTemplate(REPLY_PROMPT, {
      twinName: user.twin.name,
      personality: user.twin.personality,
      speechStyle: user.twin.speechStyle,
      conversation: conversation + `\nYou: ${body}`,
    });

    const reply = await generateReply(prompt);

    // Persist twin's reply
    await db.message.create({
      data: { userId: 1, direction: "twin_to_user", body: reply },
    });

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Reply error:", err);
    return NextResponse.json({ error: "Failed to generate reply" }, { status: 500 });
  }
}
