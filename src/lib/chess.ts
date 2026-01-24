import { Chess } from "chess.js";

/**
 * Validates if a move is legal in the given position.
 * 
 * @param fen - The Forsyth-Edwards Notation string representing the board position
 * @param move - The move to validate in Standard Algebraic Notation
 * @returns True if the move is legal, false otherwise
 */
export function validateMove(fen: string, move: string): boolean {
  const chess = new Chess(fen);
  try {
    const result = chess.move(move);
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * Applies a move to the given position and returns the resulting position.
 * 
 * @param fen - The current Forsyth-Edwards Notation string
 * @param move - The move to apply in Standard Algebraic Notation
 * @returns An object containing the new FEN and PGN, or null if the move is invalid
 */
export function applyMove(fen: string, move: string): { fen: string; pgn: string } | null {
  const chess = new Chess(fen);
  try {
    chess.move(move);
    return { fen: chess.fen(), pgn: chess.pgn() };
  } catch {
    return null;
  }
}

/**
 * Gets all legal moves for the current position.
 * 
 * @param fen - The Forsyth-Edwards Notation string representing the board position
 * @returns An array of legal moves in Standard Algebraic Notation
 */
export function getLegalMoves(fen: string): string[] {
  const chess = new Chess(fen);
  return chess.moves();
}

/**
 * Gets the current turn (whose move it is).
 * 
 * @param fen - The Forsyth-Edwards Notation string representing the board position
 * @returns 'w' for white's turn, 'b' for black's turn
 */
export function getTurn(fen: string): "w" | "b" {
  const chess = new Chess(fen);
  return chess.turn();
}

/**
 * Checks if the game is over (checkmate, stalemate, draw by repetition, etc.).
 * 
 * @param fen - The Forsyth-Edwards Notation string representing the board position
 * @returns True if the game is over, false otherwise
 */
export function isGameOver(fen: string): boolean {
  const chess = new Chess(fen);
  return chess.isGameOver();
}

/**
 * Gets the result of the game if it's over.
 * 
 * @param fen - The Forsyth-Edwards Notation string representing the board position
 * @returns The game result ('1-0' for white win, '0-1' for black win, '1/2-1/2' for draw) or null if game is not over
 */
export function getGameResult(fen: string): "1-0" | "0-1" | "1/2-1/2" | null {
  const chess = new Chess(fen);
  if (!chess.isGameOver()) return null;

  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? "0-1" : "1-0";
  }
  return "1/2-1/2"; // stalemate or draw
}

/**
 * Gets the current move number from the FEN.
 * 
 * @param fen - The Forsyth-Edwards Notation string representing the board position
 * @returns The current move number
 */
export function getMoveNumber(fen: string): number {
  const parts = fen.split(" ");
  return parseInt(parts[5], 10);
}

/**
 * The standard starting position in Forsyth-Edwards Notation.
 */
export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";