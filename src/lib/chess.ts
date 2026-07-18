import { Chess } from "chess.js";

/**
 * Loads a chess position from a PGN when available, falling back to a FEN.
 *
 * IMPORTANT: the chess.js `Chess` constructor only accepts a FEN string — passing
 * a PGN to it throws "Invalid FEN". Move history (needed for threefold-repetition
 * and fifty-move detection) can only be recovered by parsing the PGN, so we load
 * it with `loadPgn()` and gracefully fall back to the FEN-only position if the
 * PGN is missing or unparseable.
 *
 * @param fen - The current position in Forsyth-Edwards Notation
 * @param pgn - Optional full-game PGN with move history
 * @returns A chess.js instance positioned at the given game state
 */
function loadPosition(fen: string, pgn?: string): Chess {
  if (pgn && pgn.trim().length > 0) {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      return chess;
    } catch {
      // Malformed/empty PGN — fall back to the FEN-only position below.
    }
  }
  return new Chess(fen);
}

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
 * Requires PGN for proper threefold repetition detection.
 * 
 * @param fen - The Forsyth-Edwards Notation string representing the board position
 * @param pgn - Optional PGN string with full move history (required for repetition detection)
 * @returns True if the game is over, false otherwise
 */
export function isGameOver(fen: string, pgn?: string): boolean {
  const chess = loadPosition(fen, pgn);
  return chess.isGameOver();
}

/**
 * Gets the result of the game if it's over.
 * Requires PGN for proper threefold repetition detection.
 * 
 * @param fen - The Forsyth-Edwards Notation string representing the board position
 * @param pgn - Optional PGN string with full move history (required for repetition detection)
 * @returns The game result ('1-0' for white win, '0-1' for black win, '1/2-1/2' for draw) or null if game is not over
 */
export function getGameResult(fen: string, pgn?: string): "1-0" | "0-1" | "1/2-1/2" | null {
  const chess = loadPosition(fen, pgn);
  if (!chess.isGameOver()) return null;

  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? "0-1" : "1-0";
  }
  
  // Check for specific draw reasons
  if (pgn) {
    if (chess.isThreefoldRepetition()) {
      return "1/2-1/2";
    }
    if (chess.isDraw()) {
      return "1/2-1/2";
    }
  }
  
  return "1/2-1/2"; // stalemate or draw
}

/**
 * Gets a detailed reason for why the game ended.
 * 
 * @param fen - The Forsyth-Edwards Notation string representing the board position
 * @param pgn - Optional PGN string with full move history
 * @returns A string describing why the game ended, or null if game is not over
 */
export function getGameEndReason(fen: string, pgn?: string): string | null {
  const chess = loadPosition(fen, pgn);
  if (!chess.isGameOver()) return null;

  if (chess.isCheckmate()) {
    return "Checkmate";
  }
  if (chess.isStalemate()) {
    return "Stalemate";
  }
  if (pgn && chess.isThreefoldRepetition()) {
    return "Draw by threefold repetition";
  }
  if (pgn && chess.isDraw()) {
    if (chess.isDrawByFiftyMoves()) {
      return "Draw by fifty-move rule";
    }
    return "Draw by insufficient material";
  }
  return "Draw";
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