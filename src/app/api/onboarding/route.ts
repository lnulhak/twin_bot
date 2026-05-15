import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generatePlan, generateTwin } from "@/lib/llm";
import type { OnboardingInput } from "@/lib/types";

const OnboardingSchema = z.object({
  goal: z.string().min(1),
  whyItMatters: z.string().min(1),
  timelineDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  dailyHours: z.number().min(1).max(8),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/),
  currentLevel: z.string().min(1),
  timezone: z.string().min(1),
  twinName: z.string().min(1),
  twinVibe: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: OnboardingInput = OnboardingSchema.parse(body);

    // Upsert user (always id=1)
    await db.user.upsert({
      where: { id: 1 },
      update: {
        goal: input.goal,
        whyItMatters: input.whyItMatters,
        timelineDays: input.timelineDays,
        dailyHours: input.dailyHours,
        wakeTime: input.wakeTime,
        sleepTime: input.sleepTime,
        currentLevel: input.currentLevel,
        timezone: input.timezone,
      },
      create: {
        id: 1,
        goal: input.goal,
        whyItMatters: input.whyItMatters,
        timelineDays: input.timelineDays,
        dailyHours: input.dailyHours,
        wakeTime: input.wakeTime,
        sleepTime: input.sleepTime,
        currentLevel: input.currentLevel,
        timezone: input.timezone,
      },
    });

    // Clear old data on re-onboarding
    await db.block.deleteMany({ where: { userId: 1 } });
    await db.message.deleteMany({ where: { userId: 1 } });
    const existingTwin = await db.twin.findUnique({ where: { userId: 1 } });
    if (existingTwin) {
      await db.twinBlock.deleteMany({ where: { twinId: existingTwin.id } });
      await db.twin.delete({ where: { userId: 1 } });
    }

    // Generate plan first, then twin (twin needs the plan)
    const blocks = await generatePlan(input);
    const twin = await generateTwin(input, blocks);

    // Persist blocks
    await db.block.createMany({
      data: blocks.map((b) => ({
        userId: 1,
        dayNumber: b.dayNumber,
        startTime: b.startTime,
        durationMin: b.durationMin,
        type: b.type,
        description: b.description,
      })),
    });

    // Persist twin
    const createdTwin = await db.twin.create({
      data: {
        userId: 1,
        name: input.twinName,
        personality: twin.personality,
        speechStyle: twin.speechStyle,
      },
    });

    await db.twinBlock.createMany({
      data: twin.twinBlocks.map((tb) => ({
        twinId: createdTwin.id,
        dayNumber: tb.dayNumber,
        startTime: tb.startTime,
        durationMin: tb.durationMin,
        type: tb.type,
        description: tb.description,
        vibe: tb.vibe,
      })),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Onboarding error:", err);
    return NextResponse.json({ error: "Onboarding failed" }, { status: 500 });
  }
}
