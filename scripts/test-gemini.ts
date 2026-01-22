import dotenv from "dotenv";
import { Chess } from "chess.js";
import { requestMove } from "../src/lib/ai";

dotenv.config({ path: ".env.local" });
dotenv.config();

const GEMINI_MODELS = [
  "google/models/gemini-2.5-pro",
  "google/models/gemini-2.5-flash",
  "google/models/gemini-2.0-flash",
  "google/models/gemini-2.0-flash-001",
  "google/models/gemini-2.0-flash-lite",
  "google/models/gemini-2.0-flash-lite-001",
];

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("GEMINI_API_KEY missing");
    process.exit(1);
  }

  const chess = new Chess();
  const fen = chess.fen();
  const legalMoves = chess.moves();
  const lastMoves: string[] = [];

  for (const modelId of GEMINI_MODELS) {
    try {
      console.log(`\n[Test] ${modelId}`);
      const move = await requestMove(modelId, { fen, color: "white", legalMoves, lastMoves }, 1, {
        geminiApiKey: key,
      });
      console.log(`[OK] ${modelId}: ${move.move}`);
    } catch (err) {
      console.error(`[FAIL] ${modelId}:`, err instanceof Error ? err.message : err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
