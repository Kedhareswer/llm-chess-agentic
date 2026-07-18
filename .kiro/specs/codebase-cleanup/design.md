# Codebase Cleanup & Refactoring Design

## Overview
This design document outlines the technical approach for cleaning up the LLM Chess codebase, addressing dead code, duplicates, broken logic, and code quality issues identified in the requirements.

## Design Principles

1. **Backward Compatibility**: Maintain existing API contracts and database schema
2. **Incremental Changes**: Make small, testable changes that can be reviewed independently
3. **Type Safety**: Leverage TypeScript to catch errors at compile time
4. **Fail Fast**: Prefer explicit errors over silent failures
5. **Single Responsibility**: Each module should have one clear purpose

## 1. Error Handling Architecture

### 1.1 Typed Error Classes

Create a hierarchy of error types for better error handling:

```typescript
// src/lib/errors.ts

export class ChessError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class APIKeyError extends ChessError {
  constructor(provider: string, statusCode?: number) {
    super(
      `Invalid or missing API key for ${provider}`,
      'API_KEY_ERROR'
    );
    this.statusCode = statusCode;
  }
  statusCode?: number;
}

export class RateLimitError extends ChessError {
  constructor(provider: string, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${provider}`,
      'RATE_LIMIT_ERROR'
    );
    this.retryAfter = retryAfter;
  }
  retryAfter?: number;
}

export class TimeoutError extends ChessError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `${operation} timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR'
    );
    this.timeoutMs = timeoutMs;
  }
  timeoutMs: number;
}

export class InvalidMoveError extends ChessError {
  constructor(move: string, legalMoves: string[]) {
    super(
      `Invalid move "${move}". Legal moves: ${legalMoves.join(', ')}`,
      'INVALID_MOVE_ERROR'
    );
    this.move = move;
    this.legalMoves = legalMoves;
  }
  move: string;
  legalMoves: string[];
}

export class ParseError extends ChessError {
  constructor(response: string) {
    super(
      'Failed to parse AI response',
      'PARSE_ERROR'
    );
    this.response = response;
  }
  response: string;
}
```

### 1.2 Error Detection in AI Module

Update `src/lib/ai.ts` to throw typed errors:

```typescript
// In requestMove() function
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Detect API key errors
  if (errorMessage.includes('401') || errorMessage.includes('403') || 
      errorMessage.includes('Unauthorized') || errorMessage.includes('API key')) {
    throw new APIKeyError(isGroq ? 'Groq' : isGoogle ? 'Google' : 'Unknown');
  }
  
  // Detect rate limit errors
  if (errorMessage.includes('429') || errorMessage.includes('rate limit') || 
      errorMessage.includes('quota exceeded')) {
    throw new RateLimitError(isGroq ? 'Groq' : isGoogle ? 'Google' : 'Unknown');
  }
  
  // Detect timeout errors
  if (errorMessage.includes('timed out')) {
    throw new TimeoutError(`AI request for ${modelId}`, GROQ_TIMEOUT_MS);
  }
  
  lastError = error instanceof ChessError ? error : new ChessError(errorMessage, 'UNKNOWN_ERROR');
}

// After all retries fail
if (!parsed) {
  throw new ParseError(text);
}
```

### 1.3 Error Handling in Game Processor

Update `src/lib/game-processor.ts` to handle typed errors:

```typescript
try {
  moveResponse = await judgeMoveForTurn(...);
} catch (err) {
  if (err instanceof APIKeyError || err instanceof RateLimitError) {
    console.error(`[processGame] Fatal error for ${modelId}:`, err);
    await endGame(currentGame, "1/2-1/2", `Match cancelled: ${err.message}`);
    return;
  }
  
  if (err instanceof TimeoutError || err instanceof ParseError) {
    // Handle as timeout/invalid move
    moveResponse = null;
    timedOutOrFailed = true;
  } else {
    throw err; // Unexpected error
  }
}
```

## 2. Shared Utilities

### 2.1 Time Formatting Utility

Extract to `src/lib/utils.ts`:

```typescript
/**
 * Format elapsed time in MM:SS or HH:MM:SS format
 * @param ms - Milliseconds elapsed
 * @returns Formatted time string
 */
export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Sanitize model ID for use in HTML test IDs
 * @param id - Model ID to sanitize
 * @returns Sanitized ID safe for HTML attributes
 */
export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
```

### 2.2 Shared Game Data Hook

Create `src/hooks/use-game-data.ts`:

```typescript
import { useCallback, useEffect, useState } from "react";
import type { Game, Move, Model } from "@/db/schema";

export interface GameData {
  game: Game;
  moves: Move[];
  white: Model;
  black: Model;
}

export interface UseGameDataResult {
  data: GameData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and auto-refresh game data
 * @param gameId - Game ID to fetch
 * @param refreshInterval - Auto-refresh interval in ms (default: 5000)
 */
export function useGameData(
  gameId: string | null,
  refreshInterval = 5000
): UseGameDataResult {
  const [data, setData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    
    try {
      setError(null);
      const res = await fetch(`/api/games/${gameId}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch game: ${res.status}`);
      }
      
      const gameData = await res.json();
      setData(gameData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    fetchGame();
    const interval = setInterval(fetchGame, refreshInterval);
    return () => clearInterval(interval);
  }, [gameId, refreshInterval, fetchGame]);

  return { data, loading, error, refetch: fetchGame };
}
```

## 3. Database Schema Improvements

### 3.1 Use Imported Constants

Update `src/db/schema.ts`:

```typescript
import { STARTING_FEN } from "@/lib/chess";

export const games = pgTable("games", {
  // ... other fields
  fen: text("fen").notNull().default(STARTING_FEN),
  // ...
});
```

### 3.2 Add Timeout Warnings to Database

Add new column to track warnings:

```typescript
export const games = pgTable("games", {
  // ... existing fields
  whiteTimeoutWarnings: integer("white_timeout_warnings").notNull().default(0),
  blackTimeoutWarnings: integer("black_timeout_warnings").notNull().default(0),
});
```

Migration:
```sql
ALTER TABLE games 
ADD COLUMN white_timeout_warnings INTEGER NOT NULL DEFAULT 0,
ADD COLUMN black_timeout_warnings INTEGER NOT NULL DEFAULT 0;
```

## 4. Race Condition Prevention

### 4.1 Database Transaction for Game Start

Update `src/app/api/games/start/route.ts`:

```typescript
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const modelIds: string[] = Array.isArray(body.modelIds) ? body.modelIds : [];

  const uniqueIds = Array.from(new Set(modelIds)).filter(Boolean);
  if (uniqueIds.length < 2) {
    return NextResponse.json({ error: "Select at least two models" }, { status: 400 });
  }

  // Use transaction to prevent race condition
  try {
    const result = await db.transaction(async (tx) => {
      // Check for active game with row lock
      const [activeGame] = await tx
        .select()
        .from(games)
        .where(eq(games.status, "active"))
        .for("update"); // PostgreSQL row-level lock

      if (activeGame) {
        throw new Error("A game is already running");
      }

      // Ensure models exist and are active
      const activeModels = await tx
        .select()
        .from(models)
        .where(and(inArray(models.id, uniqueIds), eq(models.active, true)));

      if (activeModels.length < 2) {
        throw new Error("Selected models must exist and be active");
      }

      // Pick first two selected active models
      const [m1, m2] = activeModels;
      const white = Math.random() < 0.5 ? m1 : m2;
      const black = white.id === m1.id ? m2 : m1;

      const gameId = randomUUID();
      await tx.insert(games).values({
        id: gameId,
        whiteId: white.id,
        blackId: black.id,
        status: "active",
        startedAt: new Date(),
      });

      return { gameId, white: white.id, black: black.id };
    });

    // Kick off first move outside transaction
    const [createdGame] = await db.select().from(games).where(eq(games.id, result.gameId));
    if (createdGame) {
      try {
        await processGame(createdGame);
      } catch (e) {
        console.error("processGame after start failed", e);
      }
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
```

### 4.2 Debounced Tick Button

Create `src/hooks/use-debounced-callback.ts`:

```typescript
import { useCallback, useRef } from "react";

/**
 * Create a debounced version of a callback
 * @param callback - Function to debounce
 * @param delay - Delay in milliseconds
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingRef = useRef(false);

  return useCallback(
    ((...args: Parameters<T>) => {
      // Prevent multiple simultaneous executions
      if (isExecutingRef.current) {
        return;
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(async () => {
        isExecutingRef.current = true;
        try {
          await callback(...args);
        } finally {
          isExecutingRef.current = false;
        }
      }, delay);
    }) as T,
    [callback, delay]
  );
}
```

Usage in `game-grid.tsx`:

```typescript
const handleTickOnce = useDebouncedCallback(async () => {
  setTickInfo(null);
  try {
    const res = await fetch("/api/cron/tick");
    // ... rest of logic
  } catch (e) {
    setTickInfo(`Tick error: ${e instanceof Error ? e.message : String(e)}`);
  }
}, 1000); // 1 second debounce
```

## 5. Simplified AI Response Parsing

### 5.1 Streamlined Parser

Reduce `parseAIResponse()` to 3 strategies:

```typescript
export function parseAIResponse(response: string): MoveResponse | null {
  if (!response || response.trim().length === 0) return null;
  
  const strategies = [
    // Strategy 1: Direct JSON extraction
    () => {
      const match = response.match(/\{[\s\S]*?\}/);
      return match ? match[0] : null;
    },
    
    // Strategy 2: Markdown code block
    () => {
      const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      return codeBlockMatch ? codeBlockMatch[1] : null;
    },
    
    // Strategy 3: Natural language extraction
    () => {
      const movePatterns = [
        /"move"\s*:\s*"([^"]+)"/i,
        /\bmove[:\s]+([a-h][1-8]|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?)\b/i,
      ];
      
      for (const pattern of movePatterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          const reasoningMatch = response.match(/"reasoning"\s*:\s*"([^"]+)"/i);
          const reasoning = reasoningMatch ? reasoningMatch[1] : response.trim();
          return JSON.stringify({ move: match[1], reasoning });
        }
      }
      return null;
    },
  ];

  for (const strategy of strategies) {
    try {
      const jsonStr = strategy();
      if (!jsonStr) continue;
      
      const parsed = JSON.parse(jsonStr);
      const validated = MoveResponseSchema.safeParse(parsed);
      
      if (validated.success) {
        return validated.data;
      }
    } catch {
      // Try next strategy
    }
  }
  
  return null;
}
```

## 6. Configuration Management

### 6.1 Centralized Constants

Create `src/lib/config.ts`:

```typescript
/**
 * AI Request Timeouts
 * 
 * Groq: 7s - Fast models, typically respond in 2-3s
 * Gemini: 15s - Slower initial response, but streaming helps
 * Gateway: 8s - Other providers via AI SDK
 */
export const AI_TIMEOUTS = {
  GROQ_MS: 7_000,
  GEMINI_MS: 15_000,
  GATEWAY_MS: 8_000,
} as const;

/**
 * Game Rules
 * 
 * MAX_JUDGE_ATTEMPTS: Number of chances to correct illegal move
 * MAX_TIMEOUT_WARNINGS: Consecutive timeouts before forfeit
 * GAME_TIME_LIMIT_MS: Maximum game duration (25 minutes)
 */
export const GAME_RULES = {
  MAX_JUDGE_ATTEMPTS: 3,
  MAX_TIMEOUT_WARNINGS: 2,
  GAME_TIME_LIMIT_MS: 25 * 60 * 1000,
} as const;

/**
 * ELO Rating System
 * 
 * K_FACTOR: Rating change multiplier (32 is standard for chess)
 */
export const ELO_CONFIG = {
  K_FACTOR: 32,
  DEFAULT_RATING: 1500,
} as const;

/**
 * UI Polling Intervals
 * 
 * GAME_REFRESH_MS: How often to refresh active game
 * LEADERBOARD_REFRESH_MS: How often to refresh leaderboard
 * AUTO_TICK_MS: How often to auto-tick active games
 */
export const POLLING_INTERVALS = {
  GAME_REFRESH_MS: 2_000,
  LEADERBOARD_REFRESH_MS: 5_000,
  AUTO_TICK_MS: 3_000,
} as const;
```

## 7. API Type Safety

### 7.1 Shared API Types

Create `src/types/api.ts`:

```typescript
import { z } from "zod";
import type { Game, Model, Move } from "@/db/schema";

// Request schemas
export const StartGameRequestSchema = z.object({
  modelIds: z.array(z.string()).min(2, "At least two models required"),
});

export const SetAPIKeyRequestSchema = z.object({
  key: z.string().min(1, "API key cannot be empty"),
});

export const ToggleModelRequestSchema = z.object({
  id: z.string(),
  active: z.boolean(),
});

// Response types
export interface APIResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
}

export interface GameDetailResponse {
  game: Game;
  moves: Move[];
  white: Model;
  black: Model;
}

export interface GamesListResponse {
  games: Game[];
}

export interface LeaderboardResponse {
  models: Model[];
}

export interface TournamentStatusResponse {
  status: "running" | "stopped";
  tickCount: number;
  tickIntervalSec: number;
  lastTickAt: string | null;
  nextTickAt: string | null;
}
```

### 7.2 Validated API Routes

Example for `/api/games/start`:

```typescript
import { StartGameRequestSchema } from "@/types/api";

export async function POST(request: Request) {
  // Validate request body
  const body = await request.json().catch(() => null);
  const validation = StartGameRequestSchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.errors[0].message },
      { status: 400 }
    );
  }
  
  const { modelIds } = validation.data;
  // ... rest of logic
}
```

## 8. Performance Optimizations

### 8.1 Bulk Game Fetch Endpoint

Create `/api/games/bulk` endpoint:

```typescript
// src/app/api/games/bulk/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, models } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";
  const limit = parseInt(searchParams.get("limit") || "8", 10);

  // Fetch games
  const gamesList = await db
    .select()
    .from(games)
    .where(eq(games.status, status as "active" | "complete"))
    .orderBy(desc(games.startedAt))
    .limit(limit);

  // Fetch all unique model IDs
  const modelIds = new Set<string>();
  gamesList.forEach(game => {
    modelIds.add(game.whiteId);
    modelIds.add(game.blackId);
  });

  // Fetch all models in one query
  const modelsList = await db
    .select()
    .from(models)
    .where(inArray(models.id, Array.from(modelIds)));

  const modelsMap = new Map(modelsList.map(m => [m.id, m]));

  // Combine data
  const gamesWithModels = gamesList.map(game => ({
    ...game,
    whiteModel: modelsMap.get(game.whiteId),
    blackModel: modelsMap.get(game.blackId),
  }));

  return NextResponse.json({ games: gamesWithModels });
}
```

Usage in `game-grid.tsx`:

```typescript
async function fetchPreviousGames() {
  try {
    const res = await fetch("/api/games/bulk?status=complete&limit=8");
    if (!res.ok) return;
    const data = await res.json();
    setPreviousGames(data.games);
  } catch (err) {
    console.error('Failed to fetch previous games:', err);
  }
}
```

## 9. Dead Code Removal

### 9.1 Remove Empty Matchmaking

Option A: Remove entirely
```typescript
// Delete matchmake() function from game-processor.ts
// Remove call from cron/tick/route.ts
```

Option B: Implement basic matchmaking
```typescript
export async function matchmake(): Promise<void> {
  // Check if any game is active
  const [activeGame] = await db
    .select()
    .from(games)
    .where(eq(games.status, "active"))
    .limit(1);
  
  if (activeGame) {
    return; // Don't start new game if one is active
  }

  // Get all active models sorted by games played (prioritize less-played models)
  const activeModels = await db
    .select()
    .from(models)
    .where(eq(models.active, true))
    .orderBy(models.gamesPlayed);

  if (activeModels.length < 2) {
    return; // Need at least 2 models
  }

  // Pick two models with closest ELO ratings
  const sorted = activeModels.sort((a, b) => a.elo - b.elo);
  const [white, black] = sorted.slice(0, 2);

  // Start game
  const gameId = randomUUID();
  await db.insert(games).values({
    id: gameId,
    whiteId: white.id,
    blackId: black.id,
    status: "active",
    startedAt: new Date(),
  });

  console.log(`[matchmake] Started game: ${white.id} vs ${black.id}`);
}
```

### 9.2 Tournament Control Decision

Option A: Remove unused endpoints
- Delete `/api/tournament/start` and `/api/tournament/stop`
- Tournament status is managed automatically by game lifecycle

Option B: Add UI controls
- Add start/stop buttons to header or leaderboard
- Allow manual tournament control

**Recommendation**: Option A (remove) - tournament status is already managed automatically

## 10. File Renaming

### 10.1 Rename Key Store

Rename `src/lib/groq-key-store.ts` to `src/lib/api-key-store.ts`:

```typescript
// src/lib/api-key-store.ts
let groqApiKey: string | null = null;
let geminiApiKey: string | null = null;

export function setGroqApiKey(key: string) {
  groqApiKey = key.trim();
}

export function getGroqApiKey(): string | undefined {
  return groqApiKey || process.env.GROQ_API_KEY || undefined;
}

export function setGeminiApiKey(key: string) {
  geminiApiKey = key.trim();
}

export function getGeminiApiKey(): string | undefined {
  return geminiApiKey || process.env.GEMINI_API_KEY || undefined;
}
```

Update imports in:
- `src/lib/game-processor.ts`
- `src/app/api/tournament/groq-key/route.ts`
- `src/app/api/tournament/gemini-key/route.ts`

## Implementation Strategy

### Phase 1: Critical Fixes (P0)
1. Add typed error classes
2. Fix race condition in game start
3. Add error states to UI components

### Phase 2: Code Quality (P1)
1. Extract shared utilities
2. Add input validation
3. Create bulk fetch endpoint
4. Add debouncing

### Phase 3: Cleanup (P2)
1. Remove dead code
2. Simplify AI parsing
3. Rename files
4. Add configuration file

### Phase 4: Testing (P3)
1. Add API route tests
2. Add error path tests
3. Add integration tests

## Testing Strategy

### Unit Tests
- Test new error classes
- Test shared utilities (formatElapsed, sanitizeId)
- Test simplified AI parser

### Integration Tests
- Test game start with concurrent requests
- Test bulk fetch endpoint
- Test error handling in game processor

### E2E Tests
- Test full game flow with errors
- Test UI error states
- Test debounced tick button

## Rollback Plan

Each change should be:
1. Made in a separate commit
2. Tested independently
3. Easily revertible

If issues arise:
1. Revert specific commit
2. Fix issue
3. Re-apply change

## Success Metrics

1. **Code Quality**
   - Reduce code duplication by 30%
   - Increase type safety (no `any` types in new code)
   - All API routes have input validation

2. **Performance**
   - Reduce API calls for previous games from 9 to 1
   - Reduce polling frequency by 50% (or implement WebSockets)

3. **Reliability**
   - Zero race conditions in game creation
   - All errors properly categorized and handled
   - No silent error swallowing

4. **Maintainability**
   - All magic numbers documented
   - Shared utilities extracted
   - Consistent naming conventions

---

## Status note (2026-07-18)

Point-in-time design for the cleanup effort — narrative above is preserved. Subsequent work landed typed errors as designed; Gemini timeout is now **30s** in `AI_TIMEOUTS` (design snippets that show 15s are historical). Later features (multi-provider adapters, DB processing claim, skill modes, post-game analysis) are outside this cleanup design — see `docs/ROADMAP.md` and living docs.
