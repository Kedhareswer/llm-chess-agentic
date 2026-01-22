import { db } from "@/db";
import { games, moves, models, tournament } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMove, applyMove, getLegalMoves, getTurn, isGameOver, getGameResult, getMoveNumber } from "./chess";
import { requestMove } from "./ai";
import { calculateNewElo, outcomeFromResult } from "./elo";
import type { Game } from "@/db/schema";
import { getGroqApiKey, getGeminiApiKey } from "@/lib/groq-key-store";

// Track consecutive timeouts per game/side (white/black). Two strikes => forfeit.
const timeoutWarnings: Map<string, { white: number; black: number }> = new Map();

export async function processGame(game: Game): Promise<void> {
  // Re-fetch game to check if still active (protect against concurrent ticks)
  const [currentGame] = await db.select().from(games).where(eq(games.id, game.id));
  if (!currentGame || currentGame.status !== "active") {
    return; // Game already completed or doesn't exist
  }

  // TTL: end games older than 25 minutes as draw
  if (currentGame.startedAt && Date.now() - new Date(currentGame.startedAt).getTime() > 25 * 60 * 1000) {
    await endGame(currentGame, "1/2-1/2");
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
  let errorContext: string | undefined;
  let timedOutOrFailed = false;

  // Single attempt with 10s timeout enforced in ai.ts
  try {
    moveResponse = await requestMove(modelId, {
      fen: currentGame.fen,
      color: color as "white" | "black",
      legalMoves,
      lastMoves: recentMoves.map(m => m.moveSan),
      errorContext,
    }, 1, { groqApiKey, geminiApiKey });

    if (moveResponse && !validateMove(currentGame.fen, moveResponse.move)) {
      errorContext = `"${moveResponse.move}" is illegal. Legal moves: ${legalMoves.join(", ")}`;
      moveResponse = null;
      timedOutOrFailed = true;
    }
  } catch (err) {
    console.error(`[processGame] Move request failed for ${modelId}:`, err);
    moveResponse = null;
    timedOutOrFailed = true;
  }

  // Handle timeout/invalid: warn once, forfeit on second consecutive failure for that side
  if (!moveResponse) {
    const counts = timeoutWarnings.get(currentGame.id) || { white: 0, black: 0 };
    const key = color === "white" ? "white" : "black";
    counts[key] += 1;
    timeoutWarnings.set(currentGame.id, counts);
    console.warn(`[processGame] Timeout/invalid for ${modelId}. Warnings ${counts.white}/${counts.black}`);

    if (counts[key] >= 2) {
      console.error(`[processGame] Forfeiting ${modelId} due to repeated timeout/invalid`);
      await forfeitGame(currentGame, modelId);
      timeoutWarnings.delete(currentGame.id);
    }
    return;
  } else {
    // Successful move clears warning for that side
    const counts = timeoutWarnings.get(currentGame.id);
    if (counts) {
      const key = color === "white" ? "white" : "black";
      counts[key] = 0;
      // If both zero, remove entry
      if (counts.white === 0 && counts.black === 0) {
        timeoutWarnings.delete(currentGame.id);
      } else {
        timeoutWarnings.set(currentGame.id, counts);
      }
    }
  }

  // Apply move
  const result = applyMove(currentGame.fen, moveResponse.move);
  if (!result) {
    await forfeitGame(currentGame, modelId);
    return;
  }

  const moveNumber = getMoveNumber(currentGame.fen);

  // Store move
  await db.insert(moves).values({
    gameId: currentGame.id,
    modelId,
    moveNumber,
    moveSan: moveResponse.move,
    fenAfter: result.fen,
    reasoning: moveResponse.reasoning,
  });

  // Update game
  await db
    .update(games)
    .set({ fen: result.fen, pgn: result.pgn })
    .where(eq(games.id, currentGame.id));

  // Check for game end
  if (isGameOver(result.fen)) {
    const gameResult = getGameResult(result.fen);
    await endGame(currentGame, gameResult!);
  }
}

async function forfeitGame(game: Game, forfeitingModelId: string): Promise<void> {
  const result = forfeitingModelId === game.whiteId ? "0-1" : "1-0";
  await endGame(game, result);
}

async function endGame(game: Game, result: "1-0" | "0-1" | "1/2-1/2"): Promise<void> {
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
    .set({ status: "complete", result, endedAt: new Date() })
    .where(eq(games.id, game.id));
}

export async function matchmake(): Promise<void> {
  return;
}
