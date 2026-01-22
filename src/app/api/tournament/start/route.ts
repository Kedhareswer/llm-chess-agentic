import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  await db
    .update(tournament)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(tournament.id, 1));

  return NextResponse.json({ success: true });
}
