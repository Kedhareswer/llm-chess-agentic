import { describe, it, expect } from "vitest";
import { validateMove, getLegalMoves, getTurn, isGameOver, getGameResult, applyMove, getMoveNumber, STARTING_FEN } from "./chess";

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
