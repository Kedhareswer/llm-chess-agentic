import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { validateMove, getLegalMoves, getTurn, isGameOver, getGameResult, getGameEndReason, applyMove, getMoveNumber, STARTING_FEN } from "./chess";

/** Plays a list of SAN moves and returns the resulting fen + full-game pgn. */
function play(sans: string[]): { fen: string; pgn: string } {
  const c = new Chess();
  for (const san of sans) c.move(san);
  return { fen: c.fen(), pgn: c.pgn() };
}

describe("chess utilities", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  it("validates legal moves", () => {
    expect(validateMove(startFen, "e4")).toBe(true);
    expect(validateMove(startFen, "e5")).toBe(false); // black pawn can't move first
  });

  it("gets legal moves", () => {
    const moves = getLegalMoves(startFen);
    expect(moves).toContain("e4");
    expect(moves).toContain("Nf3");
    expect(moves.length).toBe(20);
  });

  it("gets current turn", () => {
    expect(getTurn(startFen)).toBe("w");
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(getTurn(afterE4)).toBe("b");
  });

  it("detects game over", () => {
    expect(isGameOver(startFen)).toBe(false);
    // Fool's mate position
    const checkmate = "rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(isGameOver(checkmate)).toBe(true);
  });

  it("applies valid move and returns fen and pgn", () => {
    const result = applyMove(startFen, "e4");
    expect(result).not.toBeNull();
    expect(result?.fen).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    expect(result?.pgn).toContain("1. e4");
  });

  it("returns null for invalid move", () => {
    const result = applyMove(startFen, "e5"); // black pawn can't move first
    expect(result).toBeNull();
  });

  it("extracts move number from FEN", () => {
    expect(getMoveNumber(startFen)).toBe(1);
    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    expect(getMoveNumber(afterE4)).toBe(1);
    const move5 = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 5";
    expect(getMoveNumber(move5)).toBe(5);
  });

  it("verifies STARTING_FEN is correct", () => {
    expect(STARTING_FEN).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(STARTING_FEN).toBe(startFen);
  });
});

// Regression tests for game-termination detection. These pass a PGN (full move
// history) to the game-over helpers — the exact path that was broken when the code
// did `new Chess(pgn)` (the constructor only accepts a FEN and threw on every call,
// so games never terminated cleanly and every result/ELO was corrupted).
describe("game termination via PGN", () => {
  it("does not throw and detects checkmate from a PGN", () => {
    // Fool's mate — Black delivers mate; it is White to move and in checkmate.
    const { fen, pgn } = play(["f3", "e5", "g4", "Qh4#"]);
    expect(() => isGameOver(fen, pgn)).not.toThrow();
    expect(isGameOver(fen, pgn)).toBe(true);
    expect(getGameResult(fen, pgn)).toBe("0-1");
    expect(getGameEndReason(fen, pgn)).toBe("Checkmate");
  });

  it("detects threefold repetition from a PGN", () => {
    // Knights shuffle out and back, repeating the starting position three times.
    const { fen, pgn } = play([
      "Nf3", "Nf6", "Ng1", "Ng8",
      "Nf3", "Nf6", "Ng1", "Ng8",
    ]);
    expect(isGameOver(fen, pgn)).toBe(true);
    expect(getGameResult(fen, pgn)).toBe("1/2-1/2");
    expect(getGameEndReason(fen, pgn)).toBe("Draw by threefold repetition");
  });

  it("detects stalemate from a FEN", () => {
    // Black king a8, White pawn a7, White king a6 — Black to move, not in check,
    // no legal move.
    const stalemate = "k7/P7/K7/8/8/8/8/8 b - - 0 1";
    expect(isGameOver(stalemate)).toBe(true);
    expect(getGameResult(stalemate)).toBe("1/2-1/2");
    expect(getGameEndReason(stalemate)).toBe("Stalemate");
  });

  it("detects insufficient material (K vs K) as a draw", () => {
    const kvk = "8/8/8/4k3/8/8/8/4K3 w - - 0 1";
    expect(isGameOver(kvk)).toBe(true);
    expect(getGameResult(kvk)).toBe("1/2-1/2");
  });

  it("falls back to the FEN when the PGN is unparseable", () => {
    const checkmate = "rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    expect(() => isGameOver(checkmate, "not a real pgn {{{")).not.toThrow();
    expect(isGameOver(checkmate, "not a real pgn {{{")).toBe(true);
  });

  it("reports an ongoing game as not over", () => {
    const { fen, pgn } = play(["e4", "e5", "Nf3", "Nc6"]);
    expect(isGameOver(fen, pgn)).toBe(false);
    expect(getGameResult(fen, pgn)).toBeNull();
    expect(getGameEndReason(fen, pgn)).toBeNull();
  });
});
