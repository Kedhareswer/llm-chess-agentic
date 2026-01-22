import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament, games } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processGame, matchmake } from "@/lib/game-processor";

async function handleTick(request: Request) {
  // Verify cron secret for external callers; allow same-origin/manual ticks without auth
  const authHeader = request.headers.get("authorization");
  const isDev = process.env.NODE_ENV !== "production";
  const cronSecret = process.env.CRON_SECRET;
  const hasAuth = authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!isDev && !hasAuth) {
    // In production, allow manual same-origin tick without auth as a fallback
    const referer = request.headers.get("referer") || "";
    const origin = request.headers.get("origin") || "";
    const sameOrigin = referer.includes(origin) && origin !== "";
    if (!sameOrigin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
