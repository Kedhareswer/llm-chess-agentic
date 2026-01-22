import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const [state] = await db.select().from(tournament).where(eq(tournament.id, 1));

  if (!state) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const nextTickAt = state.lastTickAt
    ? new Date(state.lastTickAt.getTime() + state.tickIntervalSec * 1000).toISOString()
    : null;

  return NextResponse.json({
    status: state.status,
    tickCount: state.tickCount,
    tickIntervalSec: state.tickIntervalSec,
    lastTickAt: state.lastTickAt?.toISOString() ?? null,
    nextTickAt,
  });
}
