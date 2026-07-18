import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, models, publicGameColumns } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
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
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 8;

  // Validate limit parameter
  if (isNaN(limit) || limit < 1 || limit > 50) {
    return NextResponse.json(
      { error: "Limit must be a number between 1 and 50" },
      { status: 400 }
    );
  }

  try {
    // Fetch games
    const gamesList = await db
      .select(publicGameColumns)
      .from(games)
      .where(eq(games.status, statusParsed.data))
      .orderBy(desc(games.startedAt))
      .limit(limit);

    // Fetch all unique model IDs
    const modelIds = new Set<string>();
    gamesList.forEach(game => {
      modelIds.add(game.whiteId);
      modelIds.add(game.blackId);
    });

    // Fetch all models in one query
    const modelsList = await db
      .select()
      .from(models)
      .where(inArray(models.id, Array.from(modelIds)));

    const modelsMap = new Map(modelsList.map(m => [m.id, m]));

    // Combine data
    const gamesWithModels = gamesList.map(game => ({
      ...game,
      whiteModel: modelsMap.get(game.whiteId),
      blackModel: modelsMap.get(game.blackId),
    }));

    return NextResponse.json({ games: gamesWithModels });
  } catch (error) {
    console.error("Bulk games fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch games" }, 
      { status: 500 }
    );
  }
}