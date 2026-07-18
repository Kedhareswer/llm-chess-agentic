import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, moves } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { analyzeGame, type Color } from "@/lib/analysis";

// Body: the start-position eval plus the White-perspective eval of the position
// after every ply, keyed by move id. Produced client-side by the Stockfish worker.
const AnalysisSchema = z.object({
  startEvalCp: z.number().finite(),
  evals: z
    .array(z.object({ moveId: z.string().uuid(), evalCp: z.number().finite() }))
    .min(1, "At least one move eval is required"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = AnalysisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.id, id));
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status !== "complete") {
    return NextResponse.json({ error: "Only completed games can be analyzed" }, { status: 400 });
  }
  // Idempotent: analysis is computed once per game.
  if (game.analyzed) {
    return NextResponse.json({ success: true, alreadyAnalyzed: true });
  }

  // Reconstruct chronological ply order server-side; align evals by move id so
  // the result is independent of the order the client sent them in.
  const gameMoves = await db
    .select({ id: moves.id, color: moves.color })
    .from(moves)
    .where(eq(moves.gameId, id))
    .orderBy(asc(moves.createdAt), asc(moves.moveNumber));

  if (gameMoves.length === 0) {
    return NextResponse.json({ error: "Game has no moves to analyze" }, { status: 400 });
  }

  const evalMap = new Map(parsed.data.evals.map((e) => [e.moveId, e.evalCp]));
  const plies: Array<{ color: Color; evalCp: number }> = [];
  for (const m of gameMoves) {
    const evalCp = evalMap.get(m.id);
    if (evalCp === undefined) {
      return NextResponse.json(
        { error: "Evaluation missing for one or more moves" },
        { status: 400 }
      );
    }
    plies.push({ color: m.color, evalCp });
  }

  const analyses = analyzeGame(parsed.data.startEvalCp, plies);

  await db.transaction(async (tx) => {
    for (let i = 0; i < gameMoves.length; i++) {
      const a = analyses[i];
      await tx
        .update(moves)
        .set({ evalCp: a.evalCp, cpLoss: a.cpLoss, moveAccuracy: a.moveAccuracy })
        .where(eq(moves.id, gameMoves[i].id));
    }
    await tx.update(games).set({ analyzed: true }).where(eq(games.id, id));
  });

  return NextResponse.json({ success: true, analyzedMoves: gameMoves.length });
}
