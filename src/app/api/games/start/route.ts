import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, models, tournament } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { processGame, purgeFailedGames } from "@/lib/game-processor";
import { getGroqApiKey, getGeminiApiKey } from "@/lib/api-key-store";
import { randomUUID } from "crypto";
import { StartGameRequestSchema } from "@/types/api";
import { encryptSecret } from "@/lib/crypto";

export async function POST(request: Request) {
  // Validate request body
  const body = await request.json().catch(() => null);
  const validation = StartGameRequestSchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }
  
  const { modelIds, groqApiKey, geminiApiKey, whiteMode, blackMode } = validation.data;
  const uniqueIds = Array.from(new Set(modelIds)).filter(Boolean);
  if (uniqueIds.length < 1 || modelIds.length < 2) {
    return NextResponse.json({ error: "Select models for both sides" }, { status: 400 });
  }

  // Fail fast if a required key is absent, BEFORE creating a game row — so a
  // missing key never leaves a phantom match in the DB. A key counts if it was
  // sent with this request (bring-your-own-key) or configured in the env.
  const needsGroq = modelIds.some((id) => id.startsWith("groq/"));
  const needsGemini = modelIds.some((id) => id.startsWith("google/"));
  if (needsGroq && !(groqApiKey?.trim() || (await getGroqApiKey()))) {
    return NextResponse.json({ error: "A Groq API key is required for the selected models. Add it in Settings." }, { status: 400 });
  }
  if (needsGemini && !(geminiApiKey?.trim() || (await getGeminiApiKey()))) {
    return NextResponse.json({ error: "A Gemini API key is required for the selected models. Add it in Settings." }, { status: 400 });
  }

  // Self-heal: clear out any matches that were cancelled before real play.
  await purgeFailedGames().catch(() => {});

  // Use transaction to prevent race condition
  try {
    const result = await db.transaction(async (tx) => {
      // Use advisory lock to prevent concurrent game creation
      // This ensures only one transaction can create a game at a time
      await tx.execute(sql`SELECT pg_advisory_xact_lock(12345)`);
      
      // Check for active game after acquiring lock
      const [activeGame] = await tx
        .select()
        .from(games)
        .where(eq(games.status, "active"));

      if (activeGame) {
        throw new Error("A game is already running");
      }

      // Ensure models exist and are active
      const activeModels = await tx
        .select()
        .from(models)
        .where(and(inArray(models.id, uniqueIds), eq(models.active, true)));

      if (activeModels.length < 1) {
        throw new Error("Selected models must exist and be active");
      }

      // Create a map for quick lookup
      const modelMap = new Map(activeModels.map(m => [m.id, m]));
      
      // Respect the order: first model is white, second is black
      const whiteModel = modelMap.get(modelIds[0]);
      const blackModel = modelMap.get(modelIds[1]);
      
      if (!whiteModel || !blackModel) {
        throw new Error("Selected models must exist and be active");
      }
      
      const white = whiteModel;
      const black = blackModel;

      const gameId = randomUUID();
      await tx.insert(games).values({
        id: gameId,
        whiteId: white.id,
        blackId: black.id,
        status: "active",
        startedAt: new Date(),
        whiteMode: whiteMode ?? "scholar",
        blackMode: blackMode ?? "scholar",
        groqApiKey: groqApiKey?.trim() ? encryptSecret(groqApiKey.trim()) : null,
        geminiApiKey: geminiApiKey?.trim() ? encryptSecret(geminiApiKey.trim()) : null,
      });

      return { gameId, white: white.id, black: black.id };
    });

    // Kick off first move outside transaction to avoid holding locks.
    const [createdGame] = await db.select().from(games).where(eq(games.id, result.gameId));
    if (createdGame) {
      try {
        await processGame(createdGame);
      } catch (e) {
        console.error("processGame after start failed", e);
      }
    }

    // If the first move aborted the game (a bad/rejected API key deletes it via
    // abortGame), report that synchronously instead of returning a dead gameId
    // the client would poll forever.
    const [stillThere] = await db.select({ id: games.id }).from(games).where(eq(games.id, result.gameId));
    if (!stillThere) {
      return NextResponse.json(
        { error: "The match could not start — the AI provider rejected the request. Check that your API key is valid." },
        { status: 400 }
      );
    }

    // Ensure tournament running
    await db
      .update(tournament)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(tournament.id, 1));

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start game";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
