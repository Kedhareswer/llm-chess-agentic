# LLM Chess Arena Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a live chess tournament where AI models compete, with real-time spectator UI showing games and reasoning.

**Architecture:** Serverless polling with Vercel Cron (1-min ticker), PostgreSQL for persistence, Next.js 15 frontend with shadcn/ui. Games processed in parallel each tick.

**Tech Stack:** Next.js 15, shadcn/ui, Tailwind CSS, PostgreSQL (Neon), AI SDK, chess.js, react-chessboard

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.env.example`

**Step 1: Initialize Next.js 15 project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

Expected: Project scaffolded with Next.js 15

**Step 2: Install dependencies**

Run:
```bash
pnpm add chess.js react-chessboard @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google ai drizzle-orm @neondatabase/serverless zod
pnpm add -D drizzle-kit @types/node
```

**Step 3: Initialize shadcn/ui**

Run:
```bash
pnpm dlx shadcn@latest init
```

Select:
- Style: Default
- Base color: Neutral
- CSS variables: Yes

**Step 4: Add shadcn components**

Run:
```bash
pnpm dlx shadcn@latest add button card dialog table badge
```

**Step 5: Create .env.example**

Create `.env.example`:
```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
CRON_SECRET=your-secret-here
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with shadcn/ui"
```

---

## Task 2: Database Schema

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Create: `drizzle.config.ts`

**Step 1: Create Drizzle config**

Create `drizzle.config.ts`:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 2: Create database schema**

Create `src/db/schema.ts`:
```typescript
import { pgTable, text, integer, uuid, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const tournamentStatusEnum = pgEnum("tournament_status", ["stopped", "running"]);
export const gameStatusEnum = pgEnum("game_status", ["active", "complete"]);
export const gameResultEnum = pgEnum("game_result", ["1-0", "0-1", "1/2-1/2"]);

export const models = pgTable("models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  elo: integer("elo").notNull().default(1500),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
});

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  whiteId: text("white_id").notNull().references(() => models.id),
  blackId: text("black_id").notNull().references(() => models.id),
  pgn: text("pgn").notNull().default(""),
  fen: text("fen").notNull().default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
  status: gameStatusEnum("status").notNull().default("active"),
  result: gameResultEnum("result"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const moves = pgTable("moves", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id").notNull().references(() => games.id),
  modelId: text("model_id").notNull().references(() => models.id),
  moveNumber: integer("move_number").notNull(),
  moveSan: text("move_san").notNull(),
  fenAfter: text("fen_after").notNull(),
  reasoning: text("reasoning").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournament = pgTable("tournament", {
  id: integer("id").primaryKey().default(1),
  status: tournamentStatusEnum("status").notNull().default("stopped"),
  tickCount: integer("tick_count").notNull().default(0),
  startedAt: timestamp("started_at"),
});

export type Model = typeof models.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Move = typeof moves.$inferSelect;
export type Tournament = typeof tournament.$inferSelect;
```

**Step 3: Create database connection**

Create `src/db/index.ts`:
```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

**Step 4: Generate and run migrations**

Run:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add database schema with Drizzle ORM"
```

---

## Task 3: Seed Models Data

**Files:**
- Create: `src/db/seed.ts`
- Modify: `package.json` (add seed script)

**Step 1: Create seed script**

Create `src/db/seed.ts`:
```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { models, tournament } from "./schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "google" },
  { id: "llama-3.1-70b", name: "Llama 3.1 70B", provider: "meta" },
  { id: "mistral-large", name: "Mistral Large", provider: "mistral" },
  { id: "command-r-plus", name: "Command R+", provider: "cohere" },
];

async function seed() {
  console.log("Seeding models...");

  for (const model of MODELS) {
    await db.insert(models).values(model).onConflictDoNothing();
  }

  await db.insert(tournament).values({ id: 1 }).onConflictDoNothing();

  console.log("Seed complete!");
}

seed().catch(console.error);
```

**Step 2: Add seed script to package.json**

Add to `package.json` scripts:
```json
"db:seed": "npx tsx src/db/seed.ts"
```

**Step 3: Run seed**

Run:
```bash
pnpm db:seed
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add seed script for models"
```

---

## Task 4: Chess Engine Module

**Files:**
- Create: `src/lib/chess.ts`
- Create: `src/lib/chess.test.ts`

**Step 1: Write failing test for chess utilities**

Create `src/lib/chess.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateMove, getLegalMoves, getTurn, isGameOver, getGameResult } from "./chess";

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
});
```

**Step 2: Install vitest and run test to verify it fails**

Run:
```bash
pnpm add -D vitest
pnpm vitest run src/lib/chess.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement chess utilities**

Create `src/lib/chess.ts`:
```typescript
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
```

**Step 4: Run tests to verify they pass**

Run:
```bash
pnpm vitest run src/lib/chess.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add chess engine utilities"
```

---

## Task 5: AI Move Service

**Files:**
- Create: `src/lib/ai.ts`
- Create: `src/lib/ai.test.ts`

**Step 1: Write failing test for AI prompt builder**

Create `src/lib/ai.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildPrompt, parseAIResponse } from "./ai";

describe("AI utilities", () => {
  it("builds chess prompt", () => {
    const prompt = buildPrompt({
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      color: "black",
      legalMoves: ["e5", "e6", "Nf6"],
      lastMoves: ["e4"],
    });

    expect(prompt).toContain("black");
    expect(prompt).toContain("e5, e6, Nf6");
    expect(prompt).toContain("e4");
  });

  it("parses valid AI response", () => {
    const response = '{"move": "e5", "reasoning": "Control the center"}';
    const result = parseAIResponse(response);
    expect(result).toEqual({ move: "e5", reasoning: "Control the center" });
  });

  it("returns null for invalid JSON", () => {
    const result = parseAIResponse("not json");
    expect(result).toBeNull();
  });

  it("returns null for missing fields", () => {
    const result = parseAIResponse('{"move": "e5"}');
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm vitest run src/lib/ai.test.ts
```

Expected: FAIL - module not found

**Step 3: Implement AI utilities**

Create `src/lib/ai.ts`:
```typescript
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

const MoveResponseSchema = z.object({
  move: z.string(),
  reasoning: z.string(),
});

type MoveResponse = z.infer<typeof MoveResponseSchema>;

interface PromptParams {
  fen: string;
  color: "white" | "black";
  legalMoves: string[];
  lastMoves: string[];
  errorContext?: string;
}

export function buildPrompt(params: PromptParams): string {
  const { fen, color, legalMoves, lastMoves, errorContext } = params;

  let prompt = `You are playing chess as ${color} against another AI model.

Current position (FEN): ${fen}
${lastMoves.length > 0 ? `Recent moves: ${lastMoves.join(", ")}` : "This is the first move."}
Legal moves: ${legalMoves.join(", ")}

${errorContext ? `IMPORTANT: ${errorContext}\n\n` : ""}Analyze the position and choose your move. Consider:
- Material balance
- Piece activity
- King safety
- Pawn structure

Respond with valid JSON only:
{"move": "your_move", "reasoning": "brief explanation"}`;

  return prompt;
}

export function parseAIResponse(response: string): MoveResponse | null {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    const validated = MoveResponseSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    }
    return null;
  } catch {
    return null;
  }
}

function getProvider(modelId: string) {
  if (modelId.startsWith("gpt")) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (modelId.startsWith("claude")) {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  if (modelId.startsWith("gemini")) {
    return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });
  }
  throw new Error(`Unknown model provider for: ${modelId}`);
}

export async function requestMove(
  modelId: string,
  params: PromptParams,
  retries = 3
): Promise<MoveResponse> {
  const provider = getProvider(modelId);
  const prompt = buildPrompt(params);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { text } = await generateText({
        model: provider(modelId),
        prompt,
        maxTokens: 500,
      });

      const parsed = parseAIResponse(text);
      if (parsed) {
        return parsed;
      }

      // Retry with JSON hint
      params.errorContext = "Your previous response was not valid JSON. Please respond with ONLY valid JSON.";

    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  throw new Error(`Failed to get valid move from ${modelId} after ${retries} attempts`);
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
pnpm vitest run src/lib/ai.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add AI move request service"
```

---

## Task 6: ELO Rating Module

**Files:**
- Create: `src/lib/elo.ts`
- Create: `src/lib/elo.test.ts`

**Step 1: Write failing test**

Create `src/lib/elo.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { calculateNewElo } from "./elo";

describe("ELO calculation", () => {
  it("winner gains, loser loses points", () => {
    const result = calculateNewElo(1500, 1500, "win");
    expect(result.newRating).toBeGreaterThan(1500);
    expect(result.change).toBe(16); // K=32, expected=0.5, (1-0.5)*32=16
  });

  it("weaker player gains more for upset", () => {
    const upset = calculateNewElo(1400, 1600, "win");
    const expected = calculateNewElo(1600, 1400, "win");
    expect(upset.change).toBeGreaterThan(expected.change);
  });

  it("draw against equal opponent is neutral", () => {
    const result = calculateNewElo(1500, 1500, "draw");
    expect(result.change).toBe(0);
  });

  it("loss decreases rating", () => {
    const result = calculateNewElo(1500, 1500, "loss");
    expect(result.newRating).toBeLessThan(1500);
    expect(result.change).toBe(-16);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm vitest run src/lib/elo.test.ts
```

Expected: FAIL

**Step 3: Implement ELO calculation**

Create `src/lib/elo.ts`:
```typescript
const K = 32;

type GameOutcome = "win" | "loss" | "draw";

interface EloResult {
  newRating: number;
  change: number;
}

export function calculateNewElo(
  playerRating: number,
  opponentRating: number,
  outcome: GameOutcome
): EloResult {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

  const actual = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;

  const change = Math.round(K * (actual - expected));
  const newRating = playerRating + change;

  return { newRating, change };
}

export function outcomeFromResult(
  result: "1-0" | "0-1" | "1/2-1/2",
  isWhite: boolean
): GameOutcome {
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return isWhite ? "win" : "loss";
  return isWhite ? "loss" : "win";
}
```

**Step 4: Run tests**

Run:
```bash
pnpm vitest run src/lib/elo.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add ELO rating calculation"
```

---

## Task 7: Tournament API Routes

**Files:**
- Create: `src/app/api/tournament/start/route.ts`
- Create: `src/app/api/tournament/stop/route.ts`
- Create: `src/app/api/tournament/reset/route.ts`
- Create: `src/app/api/tournament/state/route.ts`

**Step 1: Create tournament start route**

Create `src/app/api/tournament/start/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  await db
    .update(tournament)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(tournament.id, 1));

  return NextResponse.json({ success: true });
}
```

**Step 2: Create tournament stop route**

Create `src/app/api/tournament/stop/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  await db
    .update(tournament)
    .set({ status: "stopped" })
    .where(eq(tournament.id, 1));

  return NextResponse.json({ success: true });
}
```

**Step 3: Create tournament reset route**

Create `src/app/api/tournament/reset/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament, games, moves, models } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  // Delete all moves and games
  await db.delete(moves);
  await db.delete(games);

  // Reset all model stats
  await db
    .update(models)
    .set({ elo: 1500, gamesPlayed: 0, wins: 0, losses: 0, draws: 0 });

  // Reset tournament
  await db
    .update(tournament)
    .set({ status: "stopped", tickCount: 0, startedAt: null })
    .where(eq(tournament.id, 1));

  return NextResponse.json({ success: true });
}
```

**Step 4: Create tournament state route**

Create `src/app/api/tournament/state/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const [state] = await db
    .select()
    .from(tournament)
    .where(eq(tournament.id, 1));

  return NextResponse.json(state);
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add tournament control API routes"
```

---

## Task 8: Leaderboard and Games API Routes

**Files:**
- Create: `src/app/api/leaderboard/route.ts`
- Create: `src/app/api/games/route.ts`
- Create: `src/app/api/games/[id]/route.ts`

**Step 1: Create leaderboard route**

Create `src/app/api/leaderboard/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { models } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const leaderboard = await db
    .select()
    .from(models)
    .orderBy(desc(models.elo));

  return NextResponse.json({ models: leaderboard });
}
```

**Step 2: Create games list route**

Create `src/app/api/games/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, models } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";

  const gamesList = await db
    .select({
      id: games.id,
      whiteId: games.whiteId,
      blackId: games.blackId,
      fen: games.fen,
      status: games.status,
      result: games.result,
      startedAt: games.startedAt,
    })
    .from(games)
    .where(eq(games.status, status as "active" | "complete"))
    .orderBy(desc(games.startedAt));

  return NextResponse.json({ games: gamesList });
}
```

**Step 3: Create single game route**

Create `src/app/api/games/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, moves, models } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, id));

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const gameMoves = await db
    .select()
    .from(moves)
    .where(eq(moves.gameId, id))
    .orderBy(asc(moves.moveNumber));

  const [white] = await db.select().from(models).where(eq(models.id, game.whiteId));
  const [black] = await db.select().from(models).where(eq(models.id, game.blackId));

  return NextResponse.json({
    game,
    moves: gameMoves,
    white,
    black,
  });
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add leaderboard and games API routes"
```

---

## Task 9: Cron Tick Handler - Game Processing

**Files:**
- Create: `src/app/api/cron/tick/route.ts`
- Create: `src/lib/game-processor.ts`

**Step 1: Create game processor**

Create `src/lib/game-processor.ts`:
```typescript
import { db } from "@/db";
import { games, moves, models } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { validateMove, applyMove, getLegalMoves, getTurn, isGameOver, getGameResult, getMoveNumber } from "./chess";
import { requestMove, buildPrompt } from "./ai";
import { calculateNewElo, outcomeFromResult } from "./elo";
import type { Game } from "@/db/schema";

export async function processGame(game: Game): Promise<void> {
  const turn = getTurn(game.fen);
  const modelId = turn === "w" ? game.whiteId : game.blackId;
  const color = turn === "w" ? "white" : "black";

  // Get recent moves for context
  const recentMoves = await db
    .select({ moveSan: moves.moveSan })
    .from(moves)
    .where(eq(moves.gameId, game.id))
    .orderBy(moves.moveNumber)
    .limit(10);

  const legalMoves = getLegalMoves(game.fen);

  let moveResponse;
  let errorContext: string | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      moveResponse = await requestMove(modelId, {
        fen: game.fen,
        color: color as "white" | "black",
        legalMoves,
        lastMoves: recentMoves.map(m => m.moveSan),
        errorContext,
      });

      if (validateMove(game.fen, moveResponse.move)) {
        break;
      }

      errorContext = `"${moveResponse.move}" is illegal. Legal moves: ${legalMoves.join(", ")}`;
      moveResponse = null;

    } catch (error) {
      if (attempt === 3) {
        // Forfeit
        await forfeitGame(game, modelId);
        return;
      }
    }
  }

  if (!moveResponse) {
    await forfeitGame(game, modelId);
    return;
  }

  // Apply move
  const result = applyMove(game.fen, moveResponse.move);
  if (!result) {
    await forfeitGame(game, modelId);
    return;
  }

  const moveNumber = getMoveNumber(game.fen);

  // Store move
  await db.insert(moves).values({
    gameId: game.id,
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
    .where(eq(games.id, game.id));

  // Check for game end
  if (isGameOver(result.fen)) {
    const gameResult = getGameResult(result.fen);
    await endGame(game, gameResult!);
  }
}

async function forfeitGame(game: Game, forfeitingModelId: string): Promise<void> {
  const result = forfeitingModelId === game.whiteId ? "0-1" : "1-0";
  await endGame(game, result);
}

async function endGame(game: Game, result: "1-0" | "0-1" | "1/2-1/2"): Promise<void> {
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
```

**Step 2: Create matchmaking function**

Add to `src/lib/game-processor.ts`:
```typescript
export async function matchmake(): Promise<void> {
  // Get models not in active games
  const activeGames = await db
    .select({ whiteId: games.whiteId, blackId: games.blackId })
    .from(games)
    .where(eq(games.status, "active"));

  const busyModelIds = new Set(
    activeGames.flatMap(g => [g.whiteId, g.blackId])
  );

  const allModels = await db.select().from(models).orderBy(models.elo);
  const idleModels = allModels.filter(m => !busyModelIds.has(m.id));

  // Pair adjacent models by ELO
  for (let i = 0; i < idleModels.length - 1; i += 2) {
    const model1 = idleModels[i];
    const model2 = idleModels[i + 1];

    // Alternate colors (simple: lower ELO plays white)
    await db.insert(games).values({
      whiteId: model1.id,
      blackId: model2.id,
    });
  }
}
```

**Step 3: Create cron tick route**

Create `src/app/api/cron/tick/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { db } from "@/db";
import { tournament, games } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processGame, matchmake } from "@/lib/game-processor";

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if tournament is running
  const [state] = await db.select().from(tournament).where(eq(tournament.id, 1));

  if (state.status !== "running") {
    return NextResponse.json({ skipped: true, reason: "Tournament not running" });
  }

  // Get active games
  const activeGames = await db
    .select()
    .from(games)
    .where(eq(games.status, "active"));

  // Process all games in parallel
  await Promise.all(activeGames.map(game => processGame(game)));

  // Matchmake idle models
  await matchmake();

  // Increment tick count
  await db
    .update(tournament)
    .set({ tickCount: state.tickCount + 1 })
    .where(eq(tournament.id, 1));

  return NextResponse.json({
    success: true,
    gamesProcessed: activeGames.length,
    tickCount: state.tickCount + 1,
  });
}
```

**Step 4: Add vercel.json for cron**

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/tick",
      "schedule": "* * * * *"
    }
  ]
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cron tick handler with game processing and matchmaking"
```

---

## Task 10: Frontend - Layout and Theme

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Create: `src/components/header.tsx`

**Step 1: Update globals.css for terminal theme**

Modify `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 0%;
  --border: 0 0% 0%;
}

body {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

* {
  border-color: hsl(var(--border));
}
```

**Step 2: Create Header component**

Create `src/components/header.tsx`:
```typescript
"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

export function Header() {
  const [status, setStatus] = useState<"stopped" | "running">("stopped");
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    await fetch("/api/tournament/start", { method: "POST" });
    setStatus("running");
    setLoading(false);
  }

  async function handleStop() {
    setLoading(true);
    await fetch("/api/tournament/stop", { method: "POST" });
    setStatus("stopped");
    setLoading(false);
  }

  async function handleReset() {
    if (!confirm("Reset all games and ratings?")) return;
    setLoading(true);
    await fetch("/api/tournament/reset", { method: "POST" });
    setStatus("stopped");
    setLoading(false);
  }

  return (
    <header className="border-b-2 border-black bg-white">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-xl font-bold tracking-tight">LLM CHESS ARENA</h1>

        <nav className="flex items-center gap-4">
          <span className="text-sm">LIVE</span>
          <span className="text-gray-400">|</span>
          <span className="text-sm">LEADERBOARD</span>
        </nav>

        <div className="flex items-center gap-2">
          {status === "stopped" ? (
            <Button
              onClick={handleStart}
              disabled={loading}
              className="bg-black text-white hover:bg-gray-800 rounded-none"
            >
              START
            </Button>
          ) : (
            <Button
              onClick={handleStop}
              disabled={loading}
              variant="outline"
              className="border-2 border-black rounded-none"
            >
              STOP
            </Button>
          )}
          <Button
            onClick={handleReset}
            disabled={loading}
            variant="outline"
            className="border-2 border-black rounded-none"
          >
            RESET
          </Button>
        </div>
      </div>
    </header>
  );
}
```

**Step 3: Update layout**

Modify `src/app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "LLM Chess Arena",
  description: "Watch AI models compete in chess",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black">
        <div className="flex h-screen flex-col">
          <Header />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add terminal-style layout and header"
```

---

## Task 11: Frontend - Leaderboard Component

**Files:**
- Create: `src/components/leaderboard.tsx`

**Step 1: Create Leaderboard component**

Create `src/components/leaderboard.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import type { Model } from "@/db/schema";

export function Leaderboard() {
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    async function fetchLeaderboard() {
      const res = await fetch("/api/leaderboard");
      const data = await res.json();
      setModels(data.models);
    }

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border-2 border-black bg-white">
      <div className="border-b-2 border-black px-3 py-2">
        <h2 className="text-sm font-bold">LEADERBOARD</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {models.map((model, index) => (
          <div
            key={model.id}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="w-4 text-gray-500">{index + 1}.</span>
              <span className="font-medium">{model.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold">{model.elo}</span>
              <span className="text-xs text-gray-500">
                {model.wins}W {model.losses}L {model.draws}D
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add leaderboard component"
```

---

## Task 12: Frontend - Game Card and Grid

**Files:**
- Create: `src/components/game-card.tsx`
- Create: `src/components/game-grid.tsx`

**Step 1: Create GameCard component**

Create `src/components/game-card.tsx`:
```typescript
"use client";

import { Chessboard } from "react-chessboard";
import type { Game } from "@/db/schema";

interface GameCardProps {
  game: Game & { whiteName?: string; blackName?: string };
  onClick: () => void;
}

export function GameCard({ game, onClick }: GameCardProps) {
  return (
    <button
      onClick={onClick}
      className="border-2 border-black bg-white p-2 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="aspect-square w-full">
        <Chessboard
          position={game.fen}
          boardWidth={200}
          arePiecesDraggable={false}
          customBoardStyle={{
            borderRadius: "0",
          }}
        />
      </div>
      <div className="mt-2 text-xs">
        <div className="flex justify-between">
          <span className="font-medium">{game.whiteName || game.whiteId}</span>
          <span className="text-gray-500">white</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">{game.blackName || game.blackId}</span>
          <span className="text-gray-500">black</span>
        </div>
      </div>
    </button>
  );
}
```

**Step 2: Create GameGrid component**

Create `src/components/game-grid.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { GameCard } from "./game-card";
import type { Game } from "@/db/schema";

interface GameGridProps {
  onSelectGame: (gameId: string) => void;
}

export function GameGrid({ onSelectGame }: GameGridProps) {
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    async function fetchGames() {
      const res = await fetch("/api/games?status=active");
      const data = await res.json();
      setGames(data.games);
    }

    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  if (games.length === 0) {
    return (
      <div className="flex h-full items-center justify-center border-2 border-black bg-white">
        <p className="text-gray-500">No active games. Start the tournament!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          onClick={() => onSelectGame(game.id)}
        />
      ))}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add game card and grid components"
```

---

## Task 13: Frontend - Game Detail Modal

**Files:**
- Create: `src/components/game-detail.tsx`
- Create: `src/components/reasoning-panel.tsx`

**Step 1: Create ReasoningPanel component**

Create `src/components/reasoning-panel.tsx`:
```typescript
import type { Move, Model } from "@/db/schema";

interface ReasoningPanelProps {
  model: Model;
  moves: Move[];
  color: "white" | "black";
}

export function ReasoningPanel({ model, moves, color }: ReasoningPanelProps) {
  const modelMoves = moves.filter((m) => m.modelId === model.id);
  const latestMove = modelMoves[modelMoves.length - 1];

  return (
    <div className="flex h-full flex-col border-2 border-black bg-white">
      <div className="border-b-2 border-black px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="font-bold">{model.name}</span>
          <span className="text-xs text-gray-500">({color})</span>
        </div>
        <div className="text-sm">ELO: {model.elo}</div>
      </div>

      {latestMove && (
        <div className="border-b border-gray-200 px-3 py-2">
          <div className="text-sm font-medium">
            Move {latestMove.moveNumber}: {latestMove.moveSan}
          </div>
          <p className="mt-1 text-xs text-gray-600">{latestMove.reasoning}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="text-xs font-bold text-gray-500 mb-2">MOVE HISTORY</div>
        <div className="space-y-1">
          {modelMoves
            .slice()
            .reverse()
            .map((move) => (
              <div key={move.id} className="text-xs">
                <span className="font-medium">{move.moveNumber}.</span>{" "}
                {move.moveSan}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create GameDetail component**

Create `src/components/game-detail.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ReasoningPanel } from "./reasoning-panel";
import type { Game, Move, Model } from "@/db/schema";

interface GameDetailProps {
  gameId: string | null;
  onClose: () => void;
}

interface GameData {
  game: Game;
  moves: Move[];
  white: Model;
  black: Model;
}

export function GameDetail({ gameId, onClose }: GameDetailProps) {
  const [data, setData] = useState<GameData | null>(null);

  useEffect(() => {
    if (!gameId) {
      setData(null);
      return;
    }

    async function fetchGame() {
      const res = await fetch(`/api/games/${gameId}`);
      const gameData = await res.json();
      setData(gameData);
    }

    fetchGame();
    const interval = setInterval(fetchGame, 5000);
    return () => clearInterval(interval);
  }, [gameId]);

  if (!gameId || !data) return null;

  return (
    <Dialog open={!!gameId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl p-0 rounded-none border-2 border-black">
        <div className="border-b-2 border-black px-4 py-3">
          <h2 className="font-bold">
            {data.white.name} vs {data.black.name}
          </h2>
          {data.game.result && (
            <span className="text-sm text-gray-500">
              Result: {data.game.result}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_400px_1fr] gap-0">
          <ReasoningPanel model={data.white} moves={data.moves} color="white" />

          <div className="border-x-2 border-black p-4">
            <Chessboard
              position={data.game.fen}
              boardWidth={368}
              arePiecesDraggable={false}
              customBoardStyle={{ borderRadius: "0" }}
            />
          </div>

          <ReasoningPanel model={data.black} moves={data.moves} color="black" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add game detail modal with reasoning panels"
```

---

## Task 14: Frontend - Main Page Assembly

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Assemble main page**

Modify `src/app/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { Leaderboard } from "@/components/leaderboard";
import { GameGrid } from "@/components/game-grid";
import { GameDetail } from "@/components/game-detail";

export default function Home() {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-4">
        <GameGrid onSelectGame={setSelectedGameId} />
      </div>

      <div className="w-80 border-l-2 border-black p-4">
        <Leaderboard />
      </div>

      <GameDetail
        gameId={selectedGameId}
        onClose={() => setSelectedGameId(null)}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: assemble main page with grid and leaderboard"
```

---

## Task 15: Testing and Polish

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

**Step 1: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 2: Add test script to package.json**

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Run all tests**

Run:
```bash
pnpm test
```

Expected: All tests pass

**Step 4: Build check**

Run:
```bash
pnpm build
```

Expected: Build succeeds

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: configure vitest and verify build"
```

---

## Task 16: Deployment Preparation

**Files:**
- Create: `.env.example` (update)
- Verify: `vercel.json`

**Step 1: Verify environment variables**

Ensure `.env.example` has all required variables:
```
DATABASE_URL=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
CRON_SECRET=
```

**Step 2: Deploy to Vercel**

Run:
```bash
vercel
```

Follow prompts to link project.

**Step 3: Set environment variables in Vercel dashboard**

Set all env vars from `.env.example` in Vercel project settings.

**Step 4: Deploy production**

Run:
```bash
vercel --prod
```

**Step 5: Verify cron is active**

Check Vercel dashboard → Settings → Cron Jobs

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: prepare for Vercel deployment"
git push origin main
```

---

## Summary

16 tasks covering:
1. Project scaffolding
2. Database schema
3. Seed data
4. Chess engine
5. AI service
6. ELO calculation
7. Tournament API
8. Games API
9. Cron handler
10. Layout/theme
11. Leaderboard
12. Game grid
13. Game detail modal
14. Page assembly
15. Testing
16. Deployment

Each task follows TDD where applicable: write test → verify fail → implement → verify pass → commit.
