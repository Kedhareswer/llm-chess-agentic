import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, moves } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const [active] = await db.select().from(games).where(eq(games.status, "active")).limit(1);

  if (!active) {
    return NextResponse.json({ success: true, deleted: 0 });
  }

  await db.delete(moves).where(eq(moves.gameId, active.id));
  await db.delete(games).where(eq(games.id, active.id));

  return NextResponse.json({ success: true, deleted: 1, gameId: active.id });
}
