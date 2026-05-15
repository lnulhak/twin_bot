import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  await db.message.deleteMany({});
  await db.twinBlock.deleteMany({});
  await db.block.deleteMany({});
  await db.twin.deleteMany({});
  await db.user.deleteMany({});

  return NextResponse.json({ ok: true });
}
