import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament, games } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processGame } from "@/lib/game-processor";

async function handleTick(request: Request) {
  // Allow all tick requests - manual ticks from UI need to work without auth
  // In production, Vercel cron will still work, and manual ticks are user-initiated

  // Check if tournament is running
  const [state] = await db.select().from(tournament).where(eq(tournament.id, 1));

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

  // Increment tick count and update lastTickAt
  await db
    .update(tournament)
    .set({ tickCount: state.tickCount + 1, lastTickAt: new Date() })
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
