// Throwaway smoke test: one live move from the starting position.
import { config } from "dotenv";
config({ path: ".env.local" });

import { requestMove } from "../src/lib/ai";
import { getLegalMoves, STARTING_FEN } from "../src/lib/chess";
import { scoreMoves } from "../src/lib/engine";

async function main() {
  const modelId = process.argv[2] || "google/models/gemini-3.5-flash";
  const t0 = Date.now();
  const res = await requestMove(modelId, {
    fen: STARTING_FEN,
    color: "white",
    legalMoves: getLegalMoves(STARTING_FEN),
    lastMoves: [],
    mode: "grandmaster",
    candidates: scoreMoves(STARTING_FEN),
  }, 1);
  console.log(`OK ${modelId} in ${Date.now() - t0}ms -> move: ${res.move} | reasoning: ${res.reasoning}`);
}

main().catch(e => { console.error("FAILED:", e?.message || e); process.exit(1); });
