import { Chess } from "chess.js";

export function validateMove(fen: string, move: string): boolean {
  const chess = new Chess(fen);
  try {
    const result = chess.move(move);
    return result !== null;
  } catch {
    return false;
  }
}

export function applyMove(fen: string, move: string): { fen: string; pgn: string } | null {
  const chess = new Chess(fen);
  try {
    chess.move(move);
    return { fen: chess.fen(), pgn: chess.pgn() };
  } catch {
    return null;
  }
}

export function getLegalMoves(fen: string): string[] {
  const chess = new Chess(fen);
  return chess.moves();
}

export function getTurn(fen: string): "w" | "b" {
  const chess = new Chess(fen);
  return chess.turn();
}

export function isGameOver(fen: string): boolean {
  const chess = new Chess(fen);
  return chess.isGameOver();
}

export function getGameResult(fen: string): "1-0" | "0-1" | "1/2-1/2" | null {
  const chess = new Chess(fen);
  if (!chess.isGameOver()) return null;

  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? "0-1" : "1-0";
  }
  return "1/2-1/2"; // stalemate or draw
}

export function getMoveNumber(fen: string): number {
  const parts = fen.split(" ");
  return parseInt(parts[5], 10);
}

export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
