# Codebase Cleanup & Refactoring Requirements

## Overview
Comprehensive analysis of the LLM Chess codebase to identify dead code, duplicates, broken logic, unnecessary complexity, and areas for improvement.

## 1. Dead Code & Unused Features

### 1.1 Unused Tournament Control Features
**Status**: Partially Dead
- **Location**: `src/app/api/tournament/start/route.ts`, `src/app/api/tournament/stop/route.ts`
- **Issue**: Tournament start/stop endpoints exist but are never called from the UI
- **Evidence**: 
  - No UI buttons or components call these endpoints
  - Tournament status is automatically set to "running" when a game starts in `src/app/api/games/start/route.ts`
  - The leaderboard component doesn't have start/stop tournament controls
- **Impact**: Confusing API surface, unclear tournament lifecycle
- **Recommendation**: Either remove these endpoints or add UI controls to use them

### 1.2 Matchmaking Function
**Status**: Dead Code
- **Location**: `src/lib/game-processor.ts` - `matchmake()` function
- **Issue**: Empty function that does nothing
```typescript
export async function matchmake(): Promise<void> {
  return;
}
```
- **Called from**: `src/app/api/cron/tick/route.ts` after processing games
- **Impact**: Misleading function name suggests functionality that doesn't exist
- **Recommendation**: Remove or implement actual matchmaking logic

### 1.3 Unused Scripts
**Status**: Utility Scripts (Keep)
- **Location**: `scripts/` directory
- **Files**: `list-available-models.ts`, `model-healthcheck.ts`, `test-gemini.ts`
- **Issue**: Not integrated into main application flow
- **Impact**: Low - these are development/debugging utilities
- **Recommendation**: Keep but document their purpose in README

## 2. Duplicate & Redundant Code

### 2.1 Duplicate FEN Constants
**Status**: Duplicate
- **Location**: 
  - `src/lib/chess.ts` exports `STARTING_FEN`
  - `src/db/schema.ts` has hardcoded default FEN in schema
- **Issue**: Same starting position defined in two places
```typescript
// chess.ts
export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// schema.ts
fen: text("fen").notNull().default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
```
- **Impact**: Maintenance burden, potential for inconsistency
- **Recommendation**: Import `STARTING_FEN` from chess.ts in schema

### 2.2 Duplicate Game Fetching Logic
**Status**: Duplicate
- **Location**: 
  - `src/components/game-grid.tsx` - fetches game details
  - `src/app/game/[id]/page.tsx` - fetches game details
- **Issue**: Same pattern of fetching game + moves + models repeated
- **Impact**: Code duplication, inconsistent error handling
- **Recommendation**: Create shared `useGameData(gameId)` hook

### 2.3 Duplicate Time Formatting
**Status**: Duplicate
- **Location**:
  - `src/components/game-grid.tsx` - `formatElapsed()` function
  - `src/app/game/[id]/page.tsx` - `formatElapsed()` function
- **Issue**: Identical time formatting logic in two components
- **Impact**: Maintenance burden
- **Recommendation**: Extract to `src/lib/utils.ts`

### 2.4 Duplicate Model ID Sanitization
**Status**: Duplicate
- **Location**:
  - `e2e/single-game-flow.spec.ts` - `sanitizeId()` function
  - Multiple components use `.replace(/[^a-zA-Z0-9_-]/g, "_")` inline
- **Issue**: Same sanitization logic repeated
- **Recommendation**: Extract to shared utility

## 3. Broken & Incorrect Logic

### 3.1 Race Condition in Game Processing
**Status**: Partially Fixed but Vulnerable
- **Location**: `src/lib/game-processor.ts` - `processGame()` function
- **Issue**: 
  - Uses `processingGames` Set to prevent concurrent processing
  - BUT: Multiple tick requests can still be triggered simultaneously from UI and cron
  - The "Tick once" button in UI can be clicked multiple times rapidly
- **Evidence**:
```typescript
// game-grid.tsx - no debouncing on tick button
async function handleTickOnce() {
  const res = await fetch("/api/cron/tick");
  // ...
}
```
- **Impact**: Potential duplicate moves, race conditions in ELO updates
- **Recommendation**: Add request debouncing, use database-level locking

### 3.2 Inconsistent Error Handling in AI Requests
**Status**: Broken
- **Location**: `src/lib/ai.ts` - `requestMove()` function
- **Issue**: 
  - Throws error after retries fail
  - BUT: Error is caught in `game-processor.ts` and treated as timeout
  - API key errors (401/403) are only detected in game-processor, not in ai.ts
- **Evidence**:
```typescript
// ai.ts - throws generic error
throw (lastError ?? new Error(`All attempts failed for ${modelId}`));

// game-processor.ts - catches and checks message string
if (error.message.includes("401") || error.message.includes("403")) {
  // Handle API key error
}
```
- **Impact**: Poor error categorization, string-based error detection is fragile
- **Recommendation**: Create typed error classes (APIKeyError, TimeoutError, etc.)

### 3.3 Silent Error Swallowing
**Status**: Bad Practice
- **Location**: Multiple components
- **Issue**: Try-catch blocks that silently ignore errors
- **Examples**:
```typescript
// game-grid.tsx
} catch (err) {
  // Silently handle network errors to prevent UI crashes
  console.error('Failed to fetch games:', err);
}

// leaderboard.tsx
} catch (err) {
  // Silently handle network errors to prevent UI crashes
  console.error('Failed to fetch leaderboard:', err);
}
```
- **Impact**: Users don't know when things fail, hard to debug
- **Recommendation**: Show error states in UI

### 3.4 Incorrect Game Time Limit Logic
**Status**: Potential Bug
- **Location**: `src/lib/game-processor.ts`
- **Issue**: 25-minute TTL check happens once per tick
```typescript
if (currentGame.startedAt && Date.now() - new Date(currentGame.startedAt).getTime() > 25 * 60 * 1000) {
  await endGame(currentGame, "1/2-1/2", "Game exceeded 25 minute time limit");
  return;
}
```
- **Problem**: If ticks stop (tournament paused, server down), game can exceed 25 minutes
- **Impact**: Games can run indefinitely if tick system fails
- **Recommendation**: Add database-level check or scheduled cleanup job

### 3.5 Missing Validation in Game Start
**Status**: Potential Bug
- **Location**: `src/app/api/games/start/route.ts`
- **Issue**: Checks for "only one active game allowed" but doesn't handle concurrent requests
```typescript
const [activeGame] = await db.select().from(games).where(eq(games.status, "active"));
if (activeGame) {
  return NextResponse.json({ error: "A game is already running" }, { status: 400 });
}
// Race condition: two requests can both pass this check
```
- **Impact**: Multiple games could be created simultaneously
- **Recommendation**: Use database transaction with SELECT FOR UPDATE

## 4. Unnecessary Complexity

### 4.1 Over-Engineered AI Response Parsing
**Status**: Overly Complex
- **Location**: `src/lib/ai.ts` - `parseAIResponse()` function
- **Issue**: 5 different parsing strategies with fallbacks
- **Evidence**: 150+ lines of parsing logic with regex, JSON fixing, natural language extraction
- **Impact**: Hard to maintain, debug, and test
- **Recommendation**: Simplify to 2-3 strategies, rely on structured output from AI SDK

### 4.2 Redundant Judge Layer
**Status**: Questionable Design
- **Location**: `src/lib/game-processor.ts` - `judgeMoveForTurn()` function
- **Issue**: 
  - Validates moves after AI returns them
  - Gives model 3 chances to correct illegal moves
  - BUT: AI is already given legal moves in prompt
- **Impact**: Adds complexity, multiple retry loops
- **Recommendation**: Consider failing fast on first illegal move instead of 3 retries

### 4.3 Complex Timeout Warning System
**Status**: Overly Complex
- **Location**: `src/lib/game-processor.ts` - `timeoutWarnings` Map
- **Issue**: 
  - Tracks warnings per game per side
  - Manual cleanup required
  - State persists in memory (lost on server restart)
- **Impact**: Fragile state management
- **Recommendation**: Store warnings in database or simplify to immediate forfeit

### 4.4 Proxy-Based Database Export
**Status**: Unnecessary
- **Location**: `src/db/index.ts`
- **Issue**: Uses Proxy to lazily initialize database
```typescript
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  }
});
```
- **Impact**: Adds indirection, harder to type-check
- **Recommendation**: Export `getDb()` directly or initialize eagerly

## 5. Missing Features & Incomplete Implementation

### 5.1 No Concurrent Game Support
**Status**: Artificial Limitation
- **Location**: `src/app/api/games/start/route.ts`
- **Issue**: Hardcoded "only one active game allowed" check
- **Impact**: Can't run multiple games simultaneously
- **Recommendation**: Remove limitation or make it configurable

### 5.2 Incomplete Matchmaking
**Status**: Not Implemented
- **Location**: `src/lib/game-processor.ts` - empty `matchmake()` function
- **Issue**: No automatic pairing of idle models
- **Impact**: Manual game setup required
- **Recommendation**: Implement ELO-based matchmaking or remove function

### 5.3 No Game History Pagination
**Status**: Missing
- **Location**: `src/components/game-grid.tsx`
- **Issue**: Hardcoded `.slice(0, 8)` for previous games
- **Impact**: Can't view older games
- **Recommendation**: Add pagination or infinite scroll

### 5.4 Missing Model Management UI
**Status**: Incomplete
- **Location**: `src/components/leaderboard.tsx`
- **Issue**: 
  - Can toggle model active/inactive but UI is hidden
  - No way to add/remove models from UI
  - Model list is hardcoded in seed script
- **Impact**: Requires database access to manage models
- **Recommendation**: Add admin UI for model management

## 6. Code Quality Issues

### 6.1 Inconsistent Error Messages
**Status**: Poor UX
- **Location**: Throughout codebase
- **Issue**: Mix of technical and user-friendly messages
- **Examples**:
  - "Failed to parse AI response" (technical)
  - "Select exactly two models" (user-friendly)
  - "Judge failed: model did not produce legal move" (technical)
- **Recommendation**: Separate internal errors from user-facing messages

### 6.2 Magic Numbers
**Status**: Poor Maintainability
- **Location**: Multiple files
- **Examples**:
  - `GROQ_TIMEOUT_MS = 7_000` - why 7 seconds?
  - `GEMINI_TIMEOUT_MS = 15_000` - why 15 seconds?
  - `25 * 60 * 1000` - game time limit
  - `MAX_JUDGE_ATTEMPTS = 3` - why 3?
  - `K = 32` - ELO K-factor
- **Recommendation**: Document rationale in comments or config file

### 6.3 Inconsistent Naming
**Status**: Confusing
- **Location**: Throughout codebase
- **Examples**:
  - `groq-key-store.ts` also handles Gemini keys (misleading name)
  - `game-processor.ts` handles both game logic and AI orchestration
  - `reasoning` vs `reason` fields in AI responses
- **Recommendation**: Rename files and functions for clarity

### 6.4 Missing Type Safety
**Status**: Weak Types
- **Location**: Multiple API routes
- **Issue**: Using `any` or loose types
- **Examples**:
```typescript
// tournament/status/route.ts
const data = await res.json().catch(() => ({}));
// Returns empty object on error, no type safety
```
- **Recommendation**: Define proper response types

### 6.5 No Input Validation
**Status**: Security Risk
- **Location**: API routes
- **Issue**: Minimal validation of request bodies
- **Examples**:
  - `/api/games/start` - doesn't validate modelIds format
  - `/api/tournament/groq-key` - only checks if string is non-empty
- **Recommendation**: Use Zod schemas for all API inputs

## 7. Performance Issues

### 7.1 Excessive Polling
**Status**: Inefficient
- **Location**: 
  - `src/components/game-grid.tsx` - polls every 2 seconds
  - `src/components/leaderboard.tsx` - polls every 5 seconds
  - Automatic tick every 3 seconds
- **Impact**: Unnecessary database queries, API calls
- **Recommendation**: Use WebSockets or Server-Sent Events for real-time updates

### 7.2 N+1 Query Problem
**Status**: Performance Issue
- **Location**: `src/components/game-grid.tsx` - `fetchPreviousGames()`
- **Issue**: Fetches game list, then fetches details for each game individually
```typescript
const gamesWithModels = await Promise.all(
  (data.games || []).slice(0, 8).map(async (game: Game) => {
    const detailRes = await fetch(`/api/games/${game.id}`);
    // ...
  })
);
```
- **Impact**: 9 API calls instead of 1 (1 list + 8 details)
- **Recommendation**: Add endpoint that returns games with models in one query

### 7.3 Redundant Stockfish Initialization
**Status**: Potential Issue
- **Location**: `src/components/eval-bar.tsx` (not read yet, but referenced)
- **Issue**: Likely initializes Stockfish for each game card
- **Impact**: Memory usage, slow rendering
- **Recommendation**: Share single Stockfish instance

## 8. Testing Gaps

### 8.1 No Integration Tests
**Status**: Missing
- **Issue**: Only unit tests for pure functions, one E2E test
- **Impact**: No coverage of API routes, database interactions
- **Recommendation**: Add API route tests with test database

### 8.2 No Error Path Testing
**Status**: Missing
- **Issue**: Tests only cover happy paths
- **Examples**:
  - No tests for invalid moves
  - No tests for timeout scenarios
  - No tests for concurrent game creation
- **Recommendation**: Add negative test cases

### 8.3 No Property-Based Tests
**Status**: Missing
- **Issue**: Chess logic would benefit from property-based testing
- **Examples**:
  - "Any legal move should result in valid FEN"
  - "ELO changes should sum to zero for closed system"
- **Recommendation**: Add fast-check or similar library

## Acceptance Criteria

### AC1: Dead Code Removal
- [ ] Remove or implement `matchmake()` function
- [ ] Remove unused tournament start/stop endpoints OR add UI controls
- [ ] Document purpose of utility scripts in README

### AC2: Deduplication
- [ ] Extract `STARTING_FEN` to single source
- [ ] Create shared `useGameData()` hook
- [ ] Extract `formatElapsed()` to utils
- [ ] Extract `sanitizeId()` to utils

### AC3: Bug Fixes
- [ ] Add debouncing to tick button
- [ ] Create typed error classes for AI requests
- [ ] Add error states to UI components
- [ ] Fix race condition in game start with database transaction
- [ ] Add database-level game time limit check

### AC4: Simplification
- [ ] Simplify AI response parsing to 2-3 strategies
- [ ] Consider reducing judge retries from 3 to 1
- [ ] Store timeout warnings in database or simplify logic
- [ ] Remove Proxy-based database export

### AC5: Code Quality
- [ ] Add JSDoc comments for magic numbers
- [ ] Rename `groq-key-store.ts` to `api-key-store.ts`
- [ ] Define TypeScript types for all API responses
- [ ] Add Zod validation for all API inputs

### AC6: Performance
- [ ] Reduce polling frequency or implement WebSockets
- [ ] Add bulk game fetch endpoint to avoid N+1 queries
- [ ] Optimize Stockfish usage

### AC7: Testing
- [ ] Add API route integration tests
- [ ] Add error path test cases
- [ ] Add property-based tests for chess logic

## Priority Ranking

### P0 (Critical - Fix Immediately)
1. Race condition in game start (AC3)
2. Silent error swallowing (AC3)
3. Inconsistent error handling in AI requests (AC3)

### P1 (High - Fix Soon)
1. Duplicate code (AC2)
2. Excessive polling (AC6)
3. N+1 query problem (AC6)
4. Missing input validation (AC5)

### P2 (Medium - Improve)
1. Dead code removal (AC1)
2. Code simplification (AC4)
3. Code quality improvements (AC5)

### P3 (Low - Nice to Have)
1. Testing improvements (AC7)
2. Missing features (matchmaking, pagination)
3. Documentation improvements

## Out of Scope
- Rewriting in different framework
- Major architectural changes
- Adding new features beyond cleanup
- Performance optimization beyond obvious issues

---

## Status note (2026-07-18)

Point-in-time requirements — narrative above is preserved. Findings that referenced an in-memory `processingGames` Set/Map for concurrency are **obsolete**: processing now uses an atomic DB claim on `games.processing` / `games.processingStartedAt` (migration `0006` / roadmap F3). Gemini timeout references of 15s are historical; live value is 30s. Cleanup checklist items were largely completed; later feature work is tracked in `docs/ROADMAP.md`.
