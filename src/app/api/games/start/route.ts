import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, models, tournament } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { processGame } from "@/lib/game-processor";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const modelIds: string[] = Array.isArray(body.modelIds) ? body.modelIds : [];

  const uniqueIds = Array.from(new Set(modelIds)).filter(Boolean);
  if (uniqueIds.length < 2) {
    return NextResponse.json({ error: "Select at least two models" }, { status: 400 });
  }

  // ensure models exist and are active
  const activeModels = await db
    .select()
    .from(models)
    .where(and(inArray(models.id, uniqueIds), eq(models.active, true)));

  if (activeModels.length < 2) {
    return NextResponse.json({ error: "Selected models must exist and be active" }, { status: 400 });
  }

  // only one active game allowed
  const [activeGame] = await db.select().from(games).where(eq(games.status, "active"));
  if (activeGame) {
    return NextResponse.json({ error: "A game is already running" }, { status: 400 });
  }

  // pick first two selected active models
  const [m1, m2] = activeModels;
  const white = Math.random() < 0.5 ? m1 : m2;
  const black = white.id === m1.id ? m2 : m1;

  const gameId = randomUUID();
  await db
    .insert(games)
    .values({
      id: gameId,
      whiteId: white.id,
      blackId: black.id,
      status: "active",
      startedAt: new Date(),
    });

  // Kick off first move immediately so white starts
  const [createdGame] = await db.select().from(games).where(eq(games.id, gameId));
  if (createdGame) {
    try {
      await processGame(createdGame);
    } catch (e) {
      console.error("processGame after start failed", e);
    }
  }

  // ensure tournament running
  await db
    .update(tournament)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(tournament.id, 1));

  return NextResponse.json({ success: true, gameId, white: white.id, black: black.id });
}
