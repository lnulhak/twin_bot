import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { format } from "date-fns";

export async function GET() {
  try {
    const user = await db.user.findUnique({
      where: { id: 1 },
      include: {
        twin: { include: { blocks: true } },
        blocks: true,
        messages: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

    const startDate = new Date(user.createdAt);
    const today = new Date();
    const dayNumber =
      Math.floor(
        (today.getTime() - startDate.setHours(0, 0, 0, 0)) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    const todayBlocks = user.blocks.filter((b) => b.dayNumber === dayNumber);
    const todayTwinBlocks = user.twin?.blocks.filter(
      (b) => b.dayNumber === dayNumber
    ) ?? [];

    // Calculate streak
    let streak = 0;
    for (let d = dayNumber; d >= 1; d--) {
      const dayBlocks = user.blocks.filter((b) => b.dayNumber === d);
      if (dayBlocks.some((b) => b.completed)) streak++;
      else break;
    }

    const firstBlock = user.blocks.find((b) => b.dayNumber === 1);
    const firstBlockTime = firstBlock
      ? format(user.createdAt, "yyyy-MM-dd")
      : format(today, "yyyy-MM-dd");

    return NextResponse.json({
      user: {
        id: user.id,
        goal: user.goal,
        timelineDays: user.timelineDays,
        timezone: user.timezone,
      },
      twin: user.twin
        ? { name: user.twin.name, personality: user.twin.personality }
        : null,
      dayNumber,
      streak,
      startDate: firstBlockTime,
      todayBlocks,
      todayTwinBlocks,
      messages: user.messages.reverse(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load plan" }, { status: 500 });
  }
}
