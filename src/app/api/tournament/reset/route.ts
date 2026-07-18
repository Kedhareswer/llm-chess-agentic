import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament, games, moves, models } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  // Destructive: wipes all games/moves and resets every rating. Admin only.
  const denied = requireAdmin(request);
  if (denied) return denied;

  // Delete all moves and games
  await db.delete(moves);
  await db.delete(games);

  // Reset all model stats
  await db
    .update(models)
    .set({ elo: 1500, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 });

  // Reset tournament
  await db
    .update(tournament)
    .set({ status: "stopped", tickCount: 0, startedAt: null })
    .where(eq(tournament.id, 1));

  return NextResponse.json({ success: true });
}
