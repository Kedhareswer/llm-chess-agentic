import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament, games } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { processGame } from "@/lib/game-processor";

// The tick loops moves within GAME_RULES.TICK_BUDGET_MS (25s) plus one
// in-flight ply, so give the function generous headroom on Vercel.
export const maxDuration = 60;

async function handleTick(request: Request) {
  // NOTE: intentionally unauthenticated. There is no server cron (vercel.json is
  // empty) — the browser UI is the only tick driver, so gating this behind
  // CRON_SECRET would freeze all games. Ticks are safe to expose: they only
  // advance already-active games and are serialized by the DB processing claim.

  // Check if tournament is running
  const [state] = await db.select().from(tournament).where(eq(tournament.id, 1));

  // Guard against a missing singleton row (would otherwise 500 on state.status).
  if (!state) {
    return NextResponse.json({ skipped: true, reason: "Tournament not initialized" });
  }

  if (state.status !== "running") {
    return NextResponse.json({ skipped: true, reason: "Tournament not running" });
  }

  // Get active games
  const activeGames = await db
    .select()
    .from(games)
    .where(eq(games.status, "active"));

  // Process all games in parallel, but catch errors per game so one failure doesn't stop the tick
  const results = await Promise.allSettled(
    activeGames.map(game => processGame(game))
  );

  // Count successful and failed games
  const successful = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  
  if (failed > 0) {
    console.error(`[tick] ${failed} game(s) failed to process:`, 
      results
        .filter(r => r.status === "rejected")
        .map(r => r.reason)
    );
  }

  // Increment tick count atomically (avoids lost updates under concurrent ticks)
  // and update lastTickAt.
  await db
    .update(tournament)
    .set({ tickCount: sql`${tournament.tickCount} + 1`, lastTickAt: new Date() })
    .where(eq(tournament.id, 1));

  return NextResponse.json({
    success: true,
    gamesProcessed: activeGames.length,
    gamesSuccessful: successful,
    gamesFailed: failed,
    tickCount: state.tickCount + 1,
  });
}

// Vercel crons use GET requests
export async function GET(request: Request) {
  return handleTick(request);
}

// Allow POST for manual triggers
export async function POST(request: Request) {
  return handleTick(request);
}
