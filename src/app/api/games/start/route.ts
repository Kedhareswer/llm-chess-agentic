import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, models, tournament } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
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
    .where(sql`${models.id} = ANY(${uniqueIds}) AND ${models.active} = true`);

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
  await db.insert(games).values({ id: gameId, whiteId: white.id, blackId: black.id });

  // ensure tournament running
  await db
    .update(tournament)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(tournament.id, 1));

  return NextResponse.json({ success: true, gameId, white: white.id, black: black.id });
}
