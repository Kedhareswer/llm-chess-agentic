import { describe, it, expect } from "vitest";
import { scoreMoves, MATE_SCORE } from "./engine";
import { Chess } from "chess.js";

describe("engine.scoreMoves", () => {
  it("scores every legal move", () => {
    const fen = new Chess().fen();
    const scored = scoreMoves(fen);
    expect(scored.length).toBe(new Chess(fen).moves().length);
  });

  it("ranks mate-in-1 first", () => {
    // Scholar's mate position: Qxf7# is available.
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    const scored = scoreMoves(fen);
    expect(scored[0].move).toBe("Qxf7#");
    expect(scored[0].score).toBeGreaterThanOrEqual(MATE_SCORE);
  });

  it("punishes capturing a defended pawn with the queen", () => {
    // Black pawn d4 is defended by the e5 pawn; Qxd4 loses the queen for a pawn.
    const fen = "k7/8/8/4p3/3p4/8/3Q4/K7 w - - 0 1";
    const scored = scoreMoves(fen);
    const qxd4 = scored.find(s => s.move.startsWith("Qxd4"))!;
    const best = scored[0];
    expect(qxd4).toBeDefined();
    expect(best.score - qxd4.score).toBeGreaterThanOrEqual(500);
  });
});
