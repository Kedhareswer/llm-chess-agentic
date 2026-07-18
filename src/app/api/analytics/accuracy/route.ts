import { NextResponse } from "next/server";
import { db } from "@/db";
import { moves, models } from "@/db/schema";
import { eq, isNotNull, sql } from "drizzle-orm";
import { BLUNDER_CP } from "@/lib/analysis";

/**
 * Per-model benchmark stats aggregated from analyzed moves:
 * average centipawn loss (ACPL), average per-move accuracy, and blunder rate.
 * Only moves that have been scored (cp_loss not null) are counted.
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        modelId: moves.modelId,
        name: models.name,
        provider: models.provider,
        moveCount: sql<number>`count(*)`,
        acpl: sql<number>`avg(${moves.cpLoss})`,
        accuracy: sql<number>`avg(${moves.moveAccuracy})`,
        blunders: sql<number>`count(*) filter (where ${moves.cpLoss} >= ${BLUNDER_CP})`,
      })
      .from(moves)
      .innerJoin(models, eq(moves.modelId, models.id))
      .where(isNotNull(moves.cpLoss))
      .groupBy(moves.modelId, models.name, models.provider);

    const stats = rows
      .map((r) => {
        const moveCount = Number(r.moveCount);
        const blunders = Number(r.blunders);
        return {
          modelId: r.modelId,
          name: r.name,
          provider: r.provider,
          moveCount,
          acpl: Math.round(Number(r.acpl)),
          accuracy: Math.round(Number(r.accuracy) * 10) / 10,
          blunders,
          blunderRate: moveCount > 0 ? Math.round((blunders / moveCount) * 1000) / 10 : 0, // percent
        };
      })
      // Strongest first: highest accuracy, then lowest ACPL.
      .sort((a, b) => b.accuracy - a.accuracy || a.acpl - b.acpl);

    return NextResponse.json({ models: stats });
  } catch (error) {
    console.error("Accuracy analytics error:", error);
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 });
  }
}
