import { db } from "@/db";
import { games, moves, models } from "@/db/schema";
import { eq, desc, and, or, lt, isNull } from "drizzle-orm";
import { validateMove, applyMove, getLegalMoves, getTurn, isGameOver, getGameResult, getGameEndReason, getMoveNumber } from "./chess";
import { requestMove } from "./ai";
import { scoreMoves, type ScoredMove } from "./engine";
import { modeConfig, type SkillMode } from "./modes";
import { calculateNewElo, outcomeFromResult } from "./elo";
import { GAME_RULES } from "./config";
import type { Game } from "@/db/schema";
import { getGroqApiKey, getGeminiApiKey } from "@/lib/api-key-store";
import { decryptSecret } from "@/lib/crypto";
import { APIKeyError, RateLimitError, TimeoutError, ParseError } from "./errors";

// Release a stale processing claim after this long, in case an instance died
// mid-tick without clearing it. Must exceed the worst-case single ply
// (MAX_JUDGE_ATTEMPTS × the slowest provider timeout) so a slow-but-alive
// processor never has its claim stolen mid-flight.
const PROCESSING_TIMEOUT_MS = 120_000;

type PlyOutcome = "moved" | "stop";

export async function processGame(game: Game): Promise<void> {
  // Atomically claim the game before processing. This is the serverless-safe
  // replacement for an in-memory lock (a module-level Map gives no protection
  // across instances/tabs). Only one caller can flip processing false->true for
  // an active game whose prior claim is either clear or stale, so overlapping
  // ticks can never double-apply a move.
  let stamp = new Date();
  const staleBefore = new Date(Date.now() - PROCESSING_TIMEOUT_MS);
  const claimed = await db
    .update(games)
    .set({ processing: true, processingStartedAt: stamp })
    .where(
      and(
        eq(games.id, game.id),
        eq(games.status, "active"),
        or(
          eq(games.processing, false),
          isNull(games.processingStartedAt),
          lt(games.processingStartedAt, staleBefore),
        ),
      ),
    )
    .returning({ id: games.id });

  if (claimed.length === 0) {
    console.log(`[processGame] Game ${game.id} is claimed elsewhere or not active, skipping`);
    return;
  }

  // Play plies back-to-back until the game ends, a move fails, or the tick
  // budget is spent — a full game takes a handful of ticks instead of one ply
  // per 8-second browser tick.
  const deadline = Date.now() + GAME_RULES.TICK_BUDGET_MS;
  let ownsClaim = true;
  try {
    while (true) {
      const outcome = await playOnePly(game.id);
      if (outcome !== "moved" || Date.now() >= deadline) break;

      // Refresh the claim between plies and confirm we still own it. If a
      // stale-claim takeover happened, stop and leave the claim to its new owner.
      const next = new Date();
      const kept = await db
        .update(games)
        .set({ processingStartedAt: next })
        .where(and(eq(games.id, game.id), eq(games.processingStartedAt, stamp)))
        .returning({ id: games.id });
      if (kept.length === 0) {
        ownsClaim = false;
        break;
      }
      stamp = next;
    }
  } catch (error) {
    // Log unexpected errors but don't let them crash the tick
    console.error(`[processGame] Unexpected error processing game ${game.id}:`, error);
  } finally {
    // Release only a claim we still own — never a thief's.
    if (ownsClaim) {
      try {
        await db
          .update(games)
          .set({ processing: false, processingStartedAt: null })
          .where(and(eq(games.id, game.id), eq(games.processingStartedAt, stamp)));
      } catch (releaseErr) {
        console.error(`[processGame] Failed to release processing claim for ${game.id}:`, releaseErr);
      }
    }
  }
}

/**
 * Plays a single ply of the given game. Returns "moved" when a move was applied
 * and the game is still running, "stop" when the loop should end (game over,
 * failure that should wait for the next tick, or a lost race).
 */
async function playOnePly(gameId: string): Promise<PlyOutcome> {
  const [currentGame] = await db.select().from(games).where(eq(games.id, gameId));
  if (!currentGame || currentGame.status !== "active") {
    return "stop";
  }

  // TTL backstop: end runaway games as a draw.
  if (currentGame.startedAt && Date.now() - new Date(currentGame.startedAt).getTime() > GAME_RULES.GAME_TIME_LIMIT_MS) {
    await endGame(currentGame, "1/2-1/2", "Game exceeded 25 minute time limit");
    return "stop";
  }

  // Use game-specific API keys if available (decrypting at-rest values), otherwise
  // fall back to global keys.
  const groqApiKey = decryptSecret(currentGame.groqApiKey) || (await getGroqApiKey());
  const geminiApiKey = decryptSecret(currentGame.geminiApiKey) || (await getGeminiApiKey());

  const turn = getTurn(currentGame.fen);
  const modelId = turn === "w" ? currentGame.whiteId : currentGame.blackId;
  const color: "white" | "black" = turn === "w" ? "white" : "black";
  const mode = (turn === "w" ? currentGame.whiteMode : currentGame.blackMode) as SkillMode;

  // Check if required API key is available before attempting move
  const isGroq = modelId.startsWith("groq/");
  const isGoogle = modelId.startsWith("google/");
  if (isGroq && !groqApiKey) {
    console.error(`[processGame] Missing Groq API key for ${modelId}, ending game`);
    await endGame(currentGame, "1/2-1/2", `Match cancelled: Missing Groq API key`);
    return "stop";
  }
  if (isGoogle && !geminiApiKey) {
    console.error(`[processGame] Missing Gemini API key for ${modelId}, ending game`);
    await endGame(currentGame, "1/2-1/2", `Match cancelled: Missing Gemini API key`);
    return "stop";
  }

  // Get recent moves for context (include color for repetition detection).
  // Order by recency and take the LAST 10 plies, then restore chronological order.
  const recentMoves = (
    await db
      .select({ moveSan: moves.moveSan, color: moves.color })
      .from(moves)
      .where(eq(moves.gameId, currentGame.id))
      .orderBy(desc(moves.createdAt), desc(moves.moveNumber))
      .limit(10)
  ).reverse();

  const legalMoves = getLegalMoves(currentGame.fen);

  // Engine pre-screen: score every legal move (a few ms). Powers the skill
  // modes — candidate filtering for the strong ones, blunder guard for most.
  const candidates = scoreMoves(currentGame.fen);

  let moveResponse;

  // Judge layer: request a move and validate it before allowing it to hit the board.
  try {
    moveResponse = await judgeMoveForTurn({
      fen: currentGame.fen,
      color,
      legalMoves,
      lastMoves: recentMoves.map(m => m.moveSan),
      lastMovesWithColor: recentMoves.map(m => ({ move: m.moveSan, color: m.color })),
      mode,
      pgn: currentGame.pgn,
      candidates,
    }, modelId, { groqApiKey, geminiApiKey });
  } catch (err) {
    console.error(`[processGame] Move request failed for ${modelId}:`, err);

    // Fatal errors end the game immediately.
    if (err instanceof APIKeyError || err instanceof RateLimitError) {
      await endGame(currentGame, "1/2-1/2", `Match cancelled: ${err.message}`);
      return "stop";
    }

    // Transient failures (timeout / parse / judge exhaustion) count as a warning.
    if (err instanceof TimeoutError || err instanceof ParseError ||
        (err instanceof Error && err.message.includes("Judge failed"))) {
      moveResponse = null;
    } else {
      throw err; // Unexpected error — let processGame's catch log it.
    }
  }

  // Handle timeout/invalid: warn once, forfeit on second consecutive failure for that side
  if (!moveResponse) {
    const currentWarnings = color === "white" ? currentGame.whiteTimeoutWarnings : currentGame.blackTimeoutWarnings;
    const newWarningCount = currentWarnings + 1;

    await db
      .update(games)
      .set(color === "white"
        ? { whiteTimeoutWarnings: newWarningCount }
        : { blackTimeoutWarnings: newWarningCount })
      .where(eq(games.id, currentGame.id));

    console.warn(`[processGame] Timeout/invalid for ${modelId}. Warning ${newWarningCount}/${GAME_RULES.MAX_TIMEOUT_WARNINGS}`);

    if (newWarningCount >= GAME_RULES.MAX_TIMEOUT_WARNINGS) {
      console.error(`[processGame] Forfeiting ${modelId} due to repeated timeout/invalid`);
      await forfeitGame(currentGame, modelId, "Repeated timeout or invalid moves");
    }
    return "stop";
  }

  // Successful move clears warnings for that side
  if (color === "white" ? currentGame.whiteTimeoutWarnings > 0 : currentGame.blackTimeoutWarnings > 0) {
    await db
      .update(games)
      .set(color === "white" ? { whiteTimeoutWarnings: 0 } : { blackTimeoutWarnings: 0 })
      .where(eq(games.id, currentGame.id));
  }

  console.log(`[processGame] Applying move "${moveResponse.move}" for ${color} (${modelId}, ${mode})`);

  const result = applyMove(currentGame.fen, moveResponse.move);
  if (!result) {
    console.error(`[processGame] CRITICAL: applyMove failed for "${moveResponse.move}" - this should never happen after validation!`);
    await forfeitGame(currentGame, modelId, "Invalid move returned");
    return "stop";
  }

  // Optimistic-concurrency guard: only apply if the position is still the one
  // the move was computed for. If another processor won a race, drop this ply
  // (before recording the move, so a lost race never leaves a phantom move row).
  const updated = await db
    .update(games)
    .set({ fen: result.fen, pgn: result.pgn })
    .where(and(eq(games.id, currentGame.id), eq(games.fen, currentGame.fen), eq(games.status, "active")))
    .returning({ id: games.id });
  if (updated.length === 0) {
    console.warn(`[processGame] Position changed under us for game ${currentGame.id}; dropping computed move`);
    return "stop";
  }

  const moveNumber = getMoveNumber(currentGame.fen);
  const normalizedReasoning = extractReasoning(moveResponse.reasoning);

  await db.insert(moves).values({
    gameId: currentGame.id,
    modelId,
    color,
    moveNumber,
    moveSan: moveResponse.move,
    fenAfter: result.fen,
    reasoning: normalizedReasoning,
  });

  // Check for game end (use PGN for proper repetition detection)
  if (isGameOver(result.fen, result.pgn)) {
    const gameResult = getGameResult(result.fen, result.pgn);
    const reason = getGameEndReason(result.fen, result.pgn) ||
                   (gameResult === "1/2-1/2" ? "Draw" : "Checkmate");
    await endGame(currentGame, gameResult!, reason);
    return "stop";
  }

  return "moved";
}

// Judge helper: validates moves returned by the model before they can be applied.
// It will give the model up to MAX_JUDGE_ATTEMPTS chances, updating errorContext so the
// prompt clearly says the previous move was invalid and listing the legal moves.
// If all attempts fail (timeouts, invalid, parse errors), it throws so the caller
// can handle warnings/forfeits.

function extractReasoning(raw: string | undefined): string {
  if (!raw) return "No reasoning provided";
  const trimmed = raw.trim();

  // If the model returned a JSON-looking blob, try to pull the reasoning field out of it.
  try {
    // 1) Strip common ```json ... ``` wrappers even if they include leading/trailing whitespace
    const withoutFences = trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "");

    const directCandidates: string[] = [];

    // a) Try the whole string first
    directCandidates.push(withoutFences);

    // b) Try to extract a JSON object from inside a larger string
    const objectMatch = withoutFences.match(/\{[\s\S]*?\}/);
    if (objectMatch) {
      directCandidates.push(objectMatch[0]);
    }

    for (const candidate of directCandidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object") {
          if (typeof (parsed as any).reasoning === "string") return (parsed as any).reasoning.trim();
          if (typeof (parsed as any).reason === "string") return (parsed as any).reason.trim();
          if (typeof parsed === "string") return (parsed as string).trim();
        }
      } catch {
        // Try next candidate
      }
    }

    // c) Heuristic: extract a reasoning-like field from text that still looks JSON-ish
    const reasoningMatch = withoutFences.match(/"reasoning"\s*:\s*"([^"]+)"/i) ||
      withoutFences.match(/"reason"\s*:\s*"([^"]+)"/i);
    if (reasoningMatch && reasoningMatch[1]) {
      return reasoningMatch[1].trim();
    }
  } catch {
    // Not JSON, fall through
  }

  return trimmed;
}

async function judgeMoveForTurn(
  baseParams: {
    fen: string;
    color: "white" | "black";
    legalMoves: string[];
    lastMoves: string[];
    lastMovesWithColor?: Array<{ move: string; color: "white" | "black" }>;
    mode?: SkillMode;
    pgn?: string;
    candidates?: ScoredMove[];
  },
  modelId: string,
  keys: { groqApiKey?: string; geminiApiKey?: string },
) {
  let errorContext: string | undefined;
  let lastFatalError: Error | null = null;
  let lastTimeoutError: TimeoutError | null = null;
  let lastParseError: ParseError | null = null;
  let blunderWarned = false;

  const cfg = modeConfig(baseParams.mode);
  const candidates = baseParams.candidates;

  for (let attempt = 1; attempt <= GAME_RULES.MAX_JUDGE_ATTEMPTS; attempt++) {
    console.log(`[judgeMoveForTurn] Attempt ${attempt}/${GAME_RULES.MAX_JUDGE_ATTEMPTS} for ${modelId}`);
    let response: Awaited<ReturnType<typeof requestMove>>;
    try {
      response = await requestMove(
        modelId,
        { ...baseParams, errorContext },
        1,
        keys,
      );

      // Hard check against chess.js as the final judge.
      if (validateMove(baseParams.fen, response.move)) {
        // Restricted modes must pick from the engine-screened candidate list.
        if (cfg.candidateLimit && candidates && attempt < GAME_RULES.MAX_JUDGE_ATTEMPTS) {
          const allowed = candidates.slice(0, cfg.candidateLimit).map(c => c.move);
          if (!allowed.includes(response.move)) {
            console.warn(`[judgeMoveForTurn] ${modelId} picked "${response.move}" outside the candidate list. Retrying.`);
            errorContext = `Your move "${response.move}" is legal but not among the allowed candidate moves for this position. Pick EXACTLY one of: ${allowed.join(", ")}.`;
            continue;
          }
        }

        // Blunder guard: one warn-and-retry if the chosen move loses clearly
        // more material than the best candidate.
        if (cfg.blunderThresholdCp && candidates && !blunderWarned && attempt < GAME_RULES.MAX_JUDGE_ATTEMPTS) {
          const chosen = candidates.find(c => c.move === response.move);
          const best = candidates[0];
          if (chosen && best && best.score - chosen.score >= cfg.blunderThresholdCp) {
            blunderWarned = true;
            const lossPawns = ((best.score - chosen.score) / 100).toFixed(1);
            console.warn(`[judgeMoveForTurn] Blunder guard: "${response.move}" loses ~${lossPawns} pawns vs best for ${modelId}. Retrying.`);
            errorContext = `Your move "${response.move}" loses material: after the opponent's best reply you end up about ${lossPawns} pawns worse than the best move. Check for hanging pieces and recaptures. Stronger candidates: ${candidates.slice(0, 5).map(c => c.move).join(", ")}. Choose a better move.`;
            continue;
          }
        }

        // Check for repetition patterns BEFORE accepting the move
        // Only check moves made by THIS player (same color)
        const myRecentMoves = baseParams.lastMovesWithColor
          ? baseParams.lastMovesWithColor
              .filter(m => m.color === baseParams.color)
              .map(m => m.move)
              .slice(-6)
          : baseParams.lastMoves.slice(-6); // Fallback if color info not available
        const proposedMove = response.move;
        let repetitionDetected = false;

        if (myRecentMoves.length >= 4) {
          const lastMove = myRecentMoves[myRecentMoves.length - 1];
          const secondLastMove = myRecentMoves[myRecentMoves.length - 2];
          const thirdLastMove = myRecentMoves[myRecentMoves.length - 3];

          // Pattern: A-B-A-B repetition (e.g., Kd7-Kc8-Kd7-Kc8)
          if (proposedMove === thirdLastMove && lastMove === secondLastMove && lastMove !== proposedMove) {
            repetitionDetected = true;
            errorContext = `⚠️ REPETITION WARNING: You are repeating moves (${secondLastMove} -> ${proposedMove} -> ${lastMove} -> ${proposedMove}). This is weak chess! Use DIFFERENT pieces and create new threats. Choose a different move.`;
          }
          // Pattern: Same move repeated consecutively or very recently
          else if (proposedMove === lastMove || proposedMove === secondLastMove) {
            repetitionDetected = true;
            errorContext = `⚠️ REPETITION WARNING: You just played "${proposedMove}" recently. Do NOT repeat moves. Use a DIFFERENT piece and create new threats. Choose a different move from the list.`;
          }
          // Pattern: Same piece type moving repeatedly (e.g., all knight moves, all king moves)
          else {
            const proposedPiece = proposedMove.startsWith("O-") ? "K" : /^[KQRBN]/.test(proposedMove) ? proposedMove[0] : "P";
            const recentPieces = myRecentMoves.slice(-3).map(m => m.startsWith("O-") ? "K" : /^[KQRBN]/.test(m) ? m[0] : "P");
            if (recentPieces.length >= 3 && recentPieces.every(p => p === proposedPiece)) {
              repetitionDetected = true;
              const pieceName = proposedPiece === "K" ? "king" : proposedPiece === "Q" ? "queen" : proposedPiece === "R" ? "rook" : proposedPiece === "B" ? "bishop" : proposedPiece === "N" ? "knight" : "pawn";
              errorContext = `⚠️ PIECE REPETITION WARNING: You are moving the same type of piece (${pieceName}) repeatedly. Develop your other pieces and coordinate your whole army. Choose a move with a different piece.`;
            }
          }
        }

        // If repetition detected and we have retries left, warn and retry
        if (repetitionDetected && attempt < GAME_RULES.MAX_JUDGE_ATTEMPTS) {
          console.warn(`[judgeMoveForTurn] Repetition detected for ${modelId}: "${proposedMove}". Warning and retrying...`);
          continue; // Retry with errorContext warning
        }

        const warningNote = attempt > 1 ? ` ⚠ Judge retry (${attempt - 1} prior attempt${attempt - 1 > 1 ? "s" : ""})` : "";
        const annotated = warningNote ? { ...response, reasoning: `${response.reasoning}${warningNote}` } : response;
        console.log(`[judgeMoveForTurn] Accepted legal move "${response.move}" for ${modelId}${warningNote ? " after warning" : ""}`);
        return annotated;
      }

      // Warn the model and try again with updated error context for an illegal move.
      console.warn(
        `[judgeMoveForTurn] Model ${modelId} proposed illegal move "${response.move}". Asking it to try again.`,
      );
      errorContext = `Your previous move "${response.move}" was ILLEGAL. You MUST choose exactly one move from this list of legal moves: ${baseParams.legalMoves.join(", ")}. Do not repeat an illegal move; strictly pick one legal move.`;
    } catch (err) {
      console.warn(`[judgeMoveForTurn] Error from requestMove for ${modelId}:`, err);

      // If it's a fatal error (API key, rate limit), throw it immediately - don't retry
      if (err instanceof APIKeyError || err instanceof RateLimitError) {
        throw err;
      }

      // Track specific error types for better error propagation
      if (err instanceof TimeoutError) {
        lastTimeoutError = err;
      } else if (err instanceof ParseError) {
        lastParseError = err;
      } else {
        lastFatalError = err instanceof Error ? err : new Error(String(err));
      }

      errorContext = `Failed to get a valid response. You MUST pick one legal move from: ${baseParams.legalMoves.join(", ")}. Do not repeat illegal or malformed moves.`;
      continue;
    }
  }

  // If we had a fatal error in all attempts, throw that instead of generic error
  if (lastFatalError instanceof APIKeyError || lastFatalError instanceof RateLimitError) {
    throw lastFatalError;
  }

  // If all attempts were timeouts, throw the timeout error so it's handled properly
  if (lastTimeoutError) {
    throw lastTimeoutError;
  }

  // If all attempts were parse errors, throw the parse error
  if (lastParseError) {
    throw lastParseError;
  }

  throw new Error(`Judge failed: ${modelId} did not produce a legal move after ${GAME_RULES.MAX_JUDGE_ATTEMPTS} attempts`);
}

async function forfeitGame(game: Game, forfeitingModelId: string, reason: string): Promise<void> {
  const result = forfeitingModelId === game.whiteId ? "0-1" : "1-0";
  const forfeitingColor = forfeitingModelId === game.whiteId ? "White" : "Black";
  await endGame(game, result, `${forfeitingColor} forfeited: ${reason}`);
}

async function endGame(game: Game, result: "1-0" | "0-1" | "1/2-1/2", reason: string): Promise<void> {
  // Re-check game is still active to prevent double-counting from race conditions
  const [currentGame] = await db.select().from(games).where(eq(games.id, game.id));
  if (!currentGame || currentGame.status !== "active") {
    return; // Already ended by another tick
  }

  // Get current ratings
  const [white] = await db.select().from(models).where(eq(models.id, game.whiteId));
  const [black] = await db.select().from(models).where(eq(models.id, game.blackId));

  // Calculate new ELO
  const whiteOutcome = outcomeFromResult(result, true);
  const blackOutcome = outcomeFromResult(result, false);

  const whiteElo = calculateNewElo(white.elo, black.elo, whiteOutcome);
  const blackElo = calculateNewElo(black.elo, white.elo, blackOutcome);

  // Update models
  await db
    .update(models)
    .set({
      elo: whiteElo.newRating,
      gamesPlayed: white.gamesPlayed + 1,
      wins: white.wins + (whiteOutcome === "win" ? 1 : 0),
      losses: white.losses + (whiteOutcome === "loss" ? 1 : 0),
      draws: white.draws + (whiteOutcome === "draw" ? 1 : 0),
    })
    .where(eq(models.id, game.whiteId));

  await db
    .update(models)
    .set({
      elo: blackElo.newRating,
      gamesPlayed: black.gamesPlayed + 1,
      wins: black.wins + (blackOutcome === "win" ? 1 : 0),
      losses: black.losses + (blackOutcome === "loss" ? 1 : 0),
      draws: black.draws + (blackOutcome === "draw" ? 1 : 0),
    })
    .where(eq(models.id, game.blackId));

  // Update game
  await db
    .update(games)
    .set({ status: "complete", result, resultReason: reason, endedAt: new Date() })
    .where(eq(games.id, game.id));
}
