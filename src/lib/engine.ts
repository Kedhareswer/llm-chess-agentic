import { Chess } from "chess.js";

/**
 * Tiny chess.js-based move scorer used to ground LLM play: ranks candidate
 * moves and flags outright blunders (hung pieces, losing captures, missed
 * mate-in-1) so skill modes have real teeth.
 *
 * ponytail: depth-2 material-only negamax — sees "I move, they punish, count
 * material". Upgrade path if real strength is ever needed: server-side
 * Stockfish (already a dependency for the client eval bar).
 */

const PIECE_CP: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

export const MATE_SCORE = 100_000;

export interface ScoredMove {
  move: string;
  /** Centipawns from the mover's perspective; positive is good for the mover. */
  score: number;
}

/** Material balance from the side-to-move's perspective, in centipawns. */
function materialCp(chess: Chess): number {
  let score = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq) continue;
      score += sq.color === chess.turn() ? PIECE_CP[sq.type] : -PIECE_CP[sq.type];
    }
  }
  return score;
}

/** Captures and promotions first, for better alpha-beta pruning. */
function ordered(moves: string[]): string[] {
  const forcing = (m: string) => (m.includes("x") || m.includes("=") ? 1 : 0);
  return [...moves].sort((a, b) => forcing(b) - forcing(a));
}

function negamax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (chess.isCheckmate()) return -MATE_SCORE;
  if (chess.isStalemate() || chess.isDraw()) return 0;
  if (depth === 0) return materialCp(chess);

  let best = -Infinity;
  for (const m of ordered(chess.moves())) {
    chess.move(m);
    const s = -negamax(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (s > best) best = s;
    if (s > alpha) alpha = s;
    if (alpha >= beta) break;
  }
  return best;
}

// ponytail: naive opening heuristic as a tiebreak. Material dominates (100cp a
// pawn); this only orders otherwise-equal quiet moves so the candidate list
// isn't arbitrary in calm positions (center > development > castling > shuffling).
function positionalBonus(move: string, fullmove: number): number {
  if (move === "O-O") return 30;
  if (move === "O-O-O") return 25;
  if (/^[ed][45]$/.test(move)) return 25; // central pawn advance
  if (/^[NB][a-h]?[1-8]?[a-h][1-8]$/.test(move)) return 15; // minor-piece development
  if (fullmove <= 8 && move.startsWith("Q")) return -15; // early queen sortie
  if (move.startsWith("K")) return -10; // king walk (castling handled above)
  return 0;
}

/**
 * Scores every legal move in the position, best first.
 * Depth 2 = my move + opponent's best material reply (~1k nodes, a few ms).
 */
export function scoreMoves(fen: string, depth = 2): ScoredMove[] {
  const chess = new Chess(fen);
  const fullmove = parseInt(fen.split(" ")[5], 10) || 1;
  const results: ScoredMove[] = [];
  for (const m of chess.moves()) {
    chess.move(m);
    const material = -negamax(chess, depth - 1, -MATE_SCORE * 2, MATE_SCORE * 2);
    chess.undo();
    // No tiebreak on decisive scores — a mate is a mate (and formatScore keys on MATE_SCORE).
    const score = Math.abs(material) >= MATE_SCORE ? material : material + positionalBonus(m, fullmove);
    results.push({ move: m, score });
  }
  return results.sort((a, b) => b.score - a.score);
}
