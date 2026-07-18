import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { GameStatusSchema } from "@/types/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusParsed = GameStatusSchema.safeParse(searchParams.get("status") ?? "active");
  if (!statusParsed.success) {
    return NextResponse.json(
      { error: "Invalid status. Must be 'active' or 'complete'." },
      { status: 400 }
    );
  }

  try {
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
      .where(eq(games.status, statusParsed.data))
      .orderBy(desc(games.startedAt));

    return NextResponse.json({ games: gamesList });
  } catch (error) {
    console.error("Games fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}
