import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament, games, moves, models } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  // Destructive: wipes all games/moves and resets every rating. Open, like the
  // Destroy-Game action — this is a self-hosted BYOK arena, not a multi-tenant
  // service, so there is no operator/admin role to gate against.

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
