import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const blockId = parseInt(id, 10);
  if (isNaN(blockId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await db.block.update({
    where: { id: blockId },
    data: { completed: true },
  });

  return NextResponse.json({ ok: true });
}
