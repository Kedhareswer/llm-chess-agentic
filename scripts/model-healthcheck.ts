import dotenv from "dotenv";
import { Chess } from "chess.js";
import { db } from "../src/db";
import { models } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { requestMove } from "../src/lib/ai";

// Load env (prefer .env.local if present)
dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const activeModels = await db.select().from(models).where(eq(models.active, true));
  const chess = new Chess();
  const fen = chess.fen();
  const legalMoves = chess.moves();
  const lastMoves: string[] = [];

  const results: Array<{ id: string; provider: string; name: string; success: boolean; move?: string; error?: string }>
    = [];

  for (const model of activeModels) {
    const modelId = model.id;
    try {
      const move = await requestMove(modelId, { fen, color: "white", legalMoves, lastMoves });
      results.push({ id: modelId, provider: model.provider, name: model.name, success: true, move: move.move });
      console.log(`[OK] ${modelId} -> ${move.move}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: modelId, provider: model.provider, name: model.name, success: false, error: msg });
      console.error(`[FAIL] ${modelId}: ${msg}`);
      await db.delete(models).where(eq(models.id, model.id));
    }
  }

  const ok = results.filter((r) => r.success).length;
  const fail = results.length - ok;
  console.log(`\nSummary: ${ok} passed, ${fail} failed (removed).`);
  console.table(results);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
