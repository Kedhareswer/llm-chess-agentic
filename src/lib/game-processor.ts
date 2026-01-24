import { db } from "@/db";
import { games, moves, models, tournament } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMove, applyMove, getLegalMoves, getTurn, isGameOver, getGameResult, getMoveNumber } from "./chess";
import { requestMove } from "./ai";
import { calculateNewElo, outcomeFromResult } from "./elo";
import { GAME_RULES } from "./config";
import type { Game } from "@/db/schema";
import { getGroqApiKey, getGeminiApiKey } from "@/lib/api-key-store";
import { APIKeyError, RateLimitError, TimeoutError, ParseError } from "./errors";

// Track games currently being processed to prevent race conditions
const processingGames: Set<string> = new Set();

export async function processGame(game: Game): Promise<void> {
  // Prevent concurrent processing of the same game
  if (processingGames.has(game.id)) {
    console.log(`[processGame] Game ${game.id} already being processed, skipping`);
    return;
  }

  processingGames.add(game.id);

  try {
    // Re-fetch game to check if still active (protect against concurrent ticks)
    const [currentGame] = await db.select().from(games).where(eq(games.id, game.id));
    if (!currentGame || currentGame.status !== "active") {
      return; // Game already completed or doesn't exist
    }

  // TTL: end games older than 25 minutes as draw
  if (currentGame.startedAt && Date.now() - new Date(currentGame.startedAt).getTime() > GAME_RULES.GAME_TIME_LIMIT_MS) {
    await endGame(currentGame, "1/2-1/2", "Game exceeded 25 minute time limit");
    return;
  }

  const groqApiKey = getGroqApiKey();
  const geminiApiKey = getGeminiApiKey();
  console.log(`[processGame] Game ${currentGame.id}, groqApiKey present: ${!!groqApiKey}, geminiKey present: ${!!geminiApiKey}`);

  const turn = getTurn(currentGame.fen);
  const modelId = turn === "w" ? currentGame.whiteId : currentGame.blackId;
  const color = turn === "w" ? "white" : "black";

  // Get recent moves for context
  const recentMoves = await db
    .select({ moveSan: moves.moveSan })
    .from(moves)
    .where(eq(moves.gameId, currentGame.id))
    .orderBy(moves.moveNumber)
    .limit(10);

  const legalMoves = getLegalMoves(currentGame.fen);

  let moveResponse;
  let timedOutOrFailed = false;

  // Judge layer: request a move and validate it before allowing it to hit the board.
  // If the model returns an invalid move, we warn it via errorContext and immediately
  // ask again, without changing the board state.
  try {
    moveResponse = await judgeMoveForTurn({
      fen: currentGame.fen,
      color: color as "white" | "black",
      legalMoves,
      lastMoves: recentMoves.map(m => m.moveSan),
    }, modelId, { groqApiKey, geminiApiKey });
  } catch (err) {
    console.error(`[processGame] Move request failed for ${modelId}:`, err);
    
    // Handle fatal errors that should end the game
    if (err instanceof APIKeyError) {
      console.error(`[processGame] API key error detected for ${modelId}, destroying match`);
      await endGame(currentGame, "1/2-1/2", `Match cancelled: ${err.message}`);
      return;
    }
    
    if (err instanceof RateLimitError) {
      console.error(`[processGame] Rate limit error detected for ${modelId}, destroying match`);
      await endGame(currentGame, "1/2-1/2", `Match cancelled: ${err.message}`);
      return;
    }
    
    // Handle non-fatal errors as timeouts/invalid moves
    if (err instanceof TimeoutError || err instanceof ParseError) {
      moveResponse = null;
      timedOutOrFailed = true;
    } else {
      // Unexpected error - rethrow
      throw err;
    }
  }

  // Handle timeout/invalid: warn once, forfeit on second consecutive failure for that side
  if (!moveResponse) {
    // Increment timeout warning for the current player
    const currentWarnings = color === "white" ? currentGame.whiteTimeoutWarnings : currentGame.blackTimeoutWarnings;
    const newWarningCount = currentWarnings + 1;
    
    // Update the game with the new warning count
    await db
      .update(games)
      .set(color === "white" 
        ? { whiteTimeoutWarnings: newWarningCount } 
        : { blackTimeoutWarnings: newWarningCount })
      .where(eq(games.id, currentGame.id));
      
    console.warn(`[processGame] Timeout/invalid for ${modelId}. Warnings ${currentGame.whiteTimeoutWarnings + (color === "white" ? 1 : 0)}/${currentGame.blackTimeoutWarnings + (color === "black" ? 1 : 0)}`);

    if (newWarningCount >= 2) {
      console.error(`[processGame] Forfeiting ${modelId} due to repeated timeout/invalid`);
      await forfeitGame(currentGame, modelId, "Repeated timeout or invalid moves");
    }
    return;
  } else {
    // Successful move clears warning for that side
    const updates: Partial<typeof games.$inferInsert> = {};
    if (color === "white" && currentGame.whiteTimeoutWarnings > 0) {
      updates.whiteTimeoutWarnings = 0;
    } else if (color === "black" && currentGame.blackTimeoutWarnings > 0) {
      updates.blackTimeoutWarnings = 0;
    }
    
    if (Object.keys(updates).length > 0) {
      await db
        .update(games)
        .set(updates)
        .where(eq(games.id, currentGame.id));
    }
  }

  // Apply move with comprehensive validation
  console.log(`[processGame] Applying move "${moveResponse.move}" for ${color} (${modelId})`);
  console.log(`[processGame] Current FEN: ${currentGame.fen}`);
  console.log(`[processGame] Legal moves: ${legalMoves.join(", ")}`);
  
  const result = applyMove(currentGame.fen, moveResponse.move);
  if (!result) {
    console.error(`[processGame] CRITICAL: applyMove failed for "${moveResponse.move}" - this should never happen after validation!`);
    await forfeitGame(currentGame, modelId, "Invalid move returned");
    return;
  }

  const moveNumber = getMoveNumber(currentGame.fen);
  
  const normalizedReasoning = extractReasoning(moveResponse.reasoning);
  console.log(`[processGame] Move applied successfully. New FEN: ${result.fen}`);
  console.log(`[processGame] AI Reasoning: ${normalizedReasoning}`);

  // Store move with actual AI reasoning
  await db.insert(moves).values({
    gameId: currentGame.id,
    modelId,
    moveNumber,
    moveSan: moveResponse.move,
    fenAfter: result.fen,
    reasoning: normalizedReasoning, // Store actual AI reasoning, normalized if wrapped in JSON
  });

  // Update game
  await db
    .update(games)
    .set({ fen: result.fen, pgn: result.pgn })
    .where(eq(games.id, currentGame.id));

  // Check for game end
  if (isGameOver(result.fen)) {
    const gameResult = getGameResult(result.fen);
    const reason = gameResult === "1/2-1/2" ? "Draw by stalemate or insufficient material" : "Checkmate";
    await endGame(currentGame, gameResult!, reason);
  }
  } finally {
    // Always release the lock
    processingGames.delete(game.id);
  }
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
  },
  modelId: string,
  keys: { groqApiKey?: string; geminiApiKey?: string },
) {
  let errorContext: string | undefined;

  for (let attempt = 1; attempt <= GAME_RULES.MAX_JUDGE_ATTEMPTS; attempt++) {
    console.log(`[judgeMoveForTurn] Attempt ${attempt}/${GAME_RULES.MAX_JUDGE_ATTEMPTS} for ${modelId}`);
    let response;
    try {
      response = await requestMove(
        modelId,
        { ...baseParams, errorContext },
        1,
        keys,
      );

      // Hard check against chess.js as the final judge.
      if (validateMove(baseParams.fen, response.move)) {
        const warningNote = attempt > 1 ? ` ⚠ Judge retry (${attempt - 1} prior illegal attempt${attempt - 1 > 1 ? "s" : ""})` : "";
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
      errorContext = `Failed to get a valid response. You MUST pick one legal move from: ${baseParams.legalMoves.join(", ")}. Do not repeat illegal or malformed moves.`;
      continue;
    }
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