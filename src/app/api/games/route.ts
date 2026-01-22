import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, models } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";

  const gamesList = await db
    .select({
      id: games.id,
      whiteId: games.whiteId,
      blackId: games.blackId,
      fen: games.fen,
      status: games.status,
      result: games.result,
      startedAt: games.startedAt,
    })
    .from(games)
    .where(eq(games.status, status as "active" | "complete"))
    .orderBy(desc(games.startedAt));

  return NextResponse.json({ games: gamesList });
}
