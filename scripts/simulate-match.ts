import dotenv from "dotenv";
import { db } from "../src/db";
import { games, models, moves, tournament } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { processGame } from "../src/lib/game-processor";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function simulate(whiteId: string, blackId: string, maxPlies = 40) {
  console.log(`Simulating ${whiteId} (white) vs ${blackId} (black)`);

  // clear active game
  await db.delete(moves);
  await db.delete(games);

  // ensure models exist
  const whiteModel = await db.select().from(models).where(eq(models.id, whiteId));
  const blackModel = await db.select().from(models).where(eq(models.id, blackId));
  if (!whiteModel.length || !blackModel.length) {
    throw new Error("Model not found");
  }

  const gameId = randomUUID();
  await db.insert(games).values({ id: gameId, whiteId, blackId, status: "active", startedAt: new Date() });
  await db.update(tournament).set({ status: "running", startedAt: new Date() }).where(eq(tournament.id, 1));

  const [created] = await db.select().from(games).where(eq(games.id, gameId));
  for (let i = 0; i < maxPlies; i++) {
    const [current] = await db.select().from(games).where(eq(games.id, gameId));
    if (!current || current.status !== "active") break;
    console.log(`Ply ${i + 1}, turn ${current.fen.includes(' w ') ? 'white' : 'black'}`);
    await processGame(current);
  }

  const [finalGame] = await db.select().from(games).where(eq(games.id, gameId));
  const gameMoves = await db.select().from(moves).where(eq(moves.gameId, gameId)).orderBy(moves.moveNumber);

  console.log("Final game status:", finalGame?.status, finalGame?.result);
  console.log("Moves:", gameMoves.map((m) => m.moveSan).join(" "));
}

async function main() {
  // Example pairs
  await simulate("groq/llama-3.1-8b-instant", "google/models/gemini-2.5-flash");
  await simulate("groq/llama-3.3-70b-versatile", "google/models/gemini-2.0-flash");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
