import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, models, tournament } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { processGame } from "@/lib/game-processor";
import { randomUUID } from "crypto";
import { StartGameRequestSchema } from "@/types/api";

export async function POST(request: Request) {
  // Validate request body
  const body = await request.json().catch(() => null);
  const validation = StartGameRequestSchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }
  
  const { modelIds } = validation.data;
  const uniqueIds = Array.from(new Set(modelIds)).filter(Boolean);
  if (uniqueIds.length < 2) {
    return NextResponse.json({ error: "Select at least two models" }, { status: 400 });
  }

  // Use transaction to prevent race condition
  try {
    const result = await db.transaction(async (tx) => {
      // Use advisory lock to prevent concurrent game creation
      // This ensures only one transaction can create a game at a time
      await tx.execute(sql`SELECT pg_advisory_xact_lock(12345)`);
      
      // Check for active game after acquiring lock
      const [activeGame] = await tx
        .select()
        .from(games)
        .where(eq(games.status, "active"));

      if (activeGame) {
        throw new Error("A game is already running");
      }

      // Ensure models exist and are active
      const activeModels = await tx
        .select()
        .from(models)
        .where(and(inArray(models.id, uniqueIds), eq(models.active, true)));

      if (activeModels.length < 2) {
        throw new Error("Selected models must exist and be active");
      }

      // Pick first two selected active models
      const [m1, m2] = activeModels;
      const white = Math.random() < 0.5 ? m1 : m2;
      const black = white.id === m1.id ? m2 : m1;

      const gameId = randomUUID();
      await tx.insert(games).values({
        id: gameId,
        whiteId: white.id,
        blackId: black.id,
        status: "active",
        startedAt: new Date(),
      });

      return { gameId, white: white.id, black: black.id };
    });

    // Kick off first move outside transaction to avoid holding locks
    const [createdGame] = await db.select().from(games).where(eq(games.id, result.gameId));
    if (createdGame) {
      try {
        await processGame(createdGame);
      } catch (e) {
        console.error("processGame after start failed", e);
      }
    }

    // Ensure tournament running
    await db
      .update(tournament)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(tournament.id, 1));

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start game";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
