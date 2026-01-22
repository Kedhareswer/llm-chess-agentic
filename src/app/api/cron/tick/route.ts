import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament, games } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processGame, matchmake } from "@/lib/game-processor";

async function handleTick(request: Request) {
  // Verify cron secret (allow dev bypass)
  const authHeader = request.headers.get("authorization");
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Process all games in parallel
  await Promise.all(activeGames.map(game => processGame(game)));

  // Matchmake idle models
  await matchmake();

  // Increment tick count and update lastTickAt
  await db
    .update(tournament)
    .set({ tickCount: state.tickCount + 1, lastTickAt: new Date() })
    .where(eq(tournament.id, 1));

  return NextResponse.json({
    success: true,
    gamesProcessed: activeGames.length,
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
