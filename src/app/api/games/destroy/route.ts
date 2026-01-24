import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  // Find the currently active game, if any
  const [active] = await db
    .select()
    .from(games)
    .where(eq(games.status, "active"))
    .limit(1);

  if (!active) {
    return NextResponse.json({ success: true, aborted: 0 });
  }

  // Archive instead of deleting: mark status as aborted so history and moves
  // remain available for inspection and debugging.
  await db
    .update(games)
    .set({ status: "complete", resultReason: "Match manually destroyed" })
    .where(eq(games.id, active.id));

  return NextResponse.json({ success: true, aborted: 1, gameId: active.id });
}
