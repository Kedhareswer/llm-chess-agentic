import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, moves, models } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, id));

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const gameMoves = await db
    .select()
    .from(moves)
    .where(eq(moves.gameId, id))
    .orderBy(asc(moves.moveNumber));

  const [white] = await db.select().from(models).where(eq(models.id, game.whiteId));
  const [black] = await db.select().from(models).where(eq(models.id, game.blackId));

  return NextResponse.json({
    game,
    moves: gameMoves,
    white,
    black,
  });
}
