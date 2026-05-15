import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scheduleNudge } from "@/lib/openclaw";
import { format, addDays, startOfDay } from "date-fns";

export async function POST() {
  try {
    const user = await db.user.findUnique({
      where: { id: 1 },
      include: { blocks: true },
    });

    if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });

    const startDate = startOfDay(new Date(user.createdAt));
    const today = startOfDay(new Date());
    const dayNumber =
      Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const todayBlocks = user.blocks.filter((b) => b.dayNumber === dayNumber);
    const errors: string[] = [];

    for (const block of todayBlocks) {
      try {
        // Convert "HH:mm" today to ISO datetime
        const [h, m] = block.startTime.split(":").map(Number);
        const blockDate = addDays(startDate, dayNumber - 1);
        blockDate.setHours(h, m, 0, 0);
        const isoTime = format(blockDate, "yyyy-MM-dd'T'HH:mm:ss");

        await scheduleNudge(block.id, isoTime, user.timezone);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ ok: false, errors }, { status: 207 });
    }

    return NextResponse.json({ ok: true, scheduled: todayBlocks.length });
  } catch (err) {
    console.error("Schedule install error:", err);
    return NextResponse.json({ error: "Failed to install schedule" }, { status: 500 });
  }
}
