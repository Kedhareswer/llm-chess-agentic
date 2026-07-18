# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project-Specific Commands

- Database operations: `pnpm db:push` (schema changes), `pnpm db:seed` (populate data), `pnpm db:setup` (both)
- Testing: `pnpm test` (unit tests with Vitest), `pnpm test:e2e` (Playwright end-to-end tests)
- Development scripts in `/scripts/` directory for model testing and simulation

## Critical Architecture Patterns

### Game Processing System
- Games are processed via `/api/cron/tick` endpoint which calls `processGame()` in `src/lib/game-processor.ts`
- Concurrency uses an **atomic DB claim** on `games.processing` / `games.processingStartedAt` (migration `0006`). An in-memory Map is useless on serverless; overlapping ticks cannot double-apply a move. Stale claims are released after 120s.
- Each tick plays plies back-to-back until `GAME_RULES.TICK_BUDGET_MS` (25s) is spent or the game stops, so a full game takes a handful of ticks.
- Games have a 25-minute hard time limit enforced in `GAME_RULES.GAME_TIME_LIMIT_MS`
- Each side gets 2 timeout warnings before forfeit (tracked in `whiteTimeoutWarnings`/`blackTimeoutWarnings`)

### Skill Modes
- Defined in `src/lib/modes.ts`: `novice` | `apprentice` | `scholar` | `strategist` | `virtuoso` | `grandmaster` (`DEFAULT_MODE` = `scholar`)
- Each mode sets `temperature`, `candidateLimit` (null = full legal list), `blunderThresholdCp` (null = off), and a `persona` string injected into the prompt
- Per-side values stored as `games.white_mode` / `games.black_mode` (migration `0008`); passed as `whiteMode`/`blackMode` on `POST /api/games/start`
- Engine pre-screen in `src/lib/engine.ts`: depth-2 material negamax (`scoreMoves` / `ScoredMove` / `MATE_SCORE`) plus a small positional opening tiebreak; powers candidate filtering and the judge blunder guard

### AI Integration
- Direct providers use **non-streaming** `generateText`: Groq, Google Gemini, Anthropic, OpenAI (model id prefixes `groq/`, `google/`, `anthropic/`, `openai/`)
- Unknown prefixes fall through to **AI Gateway** (`streamText` with early parse)
- Gemini 3+ gets `thinkingConfig.thinkingLevel: "low"` and a larger `maxOutputTokens` budget; 2.x models omit thinking options
- Provider timeouts in `AI_TIMEOUTS`: Groq 7s, Gemini 30s, Anthropic 20s, OpenAI 20s, Gateway 8s
- Models get up to 3 judge attempts to return a legal move (`MAX_JUDGE_ATTEMPTS`)
- API keys: env vars and/or per-game `games.groqApiKey`/`games.geminiApiKey` (encrypted at rest when `ENCRYPTION_KEY` is set)

### Auth
- Helpers in `src/lib/auth.ts`: `requireAdmin`, `requireCron`
- `requireAdmin` gates `POST /api/tournament/reset` and global key routes (`groq-key`, `gemini-key`) via `Authorization: Bearer $ADMIN_TOKEN` (prod denies if unset; dev allows)
- `requireCron` **exists but is unused** — `/api/cron/tick` is intentionally ungated so the browser UI can drive ticks
- `POST /api/games/start` and `POST /api/games/destroy` are also ungated

### Error Handling
- Custom error hierarchy in `src/lib/errors.ts` with typed error classes
- Fatal errors (API key, rate limit) immediately end games
- Transient errors (timeout, parse) trigger warnings and retries
- All errors are caught and logged but don't crash the tick processor

## Database Schema Specifics

- Games: FEN/PGN, timeout warnings, `whiteMode`/`blackMode`, processing claim columns, `analyzed`, optional per-game API keys
- Moves: AI reasoning; after analysis nullable `evalCp` / `cpLoss` / `moveAccuracy` (no annotation column)
- Tournament: singleton row id=1; global API keys
- Models: ELO ratings and game statistics
- Post-game Stockfish analysis (client worker → `POST /api/games/[id]/analysis`) sets move eval columns and `games.analyzed`; ACPL / blunder rate are aggregates via `/api/analytics/accuracy`

## Testing Requirements

- Unit tests use Vitest with setup file at `tests/setup.ts`
- Test database requires `TEST_DATABASE_URL` environment variable
- E2E tests use Playwright with automatic server startup
- Database tests run migrations and truncate tables between tests

## Configuration Management

- Centralized config in `src/lib/config.ts` with constants for timeouts, game rules, ELO, and polling
- Environment variables: `DATABASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_GATEWAY_API_KEY`, `ADMIN_TOKEN`, optional `ENCRYPTION_KEY`
- Drizzle config reads from `.env.local` (not standard `.env`)

## Polling and API Usage (Vercel-Optimized)

- **Leaderboard**: No automatic polling. Fetches once on load; refetches when tab becomes visible (throttled 60s) and when user clicks the header refresh button.
- **Game data**: `GAME_REFRESH_MS` (1s) when tab visible and game active; `COMPLETED_GAME_REFRESH_MS` (60s) when game is complete; `WHEN_TAB_HIDDEN_MS` (30s) when tab hidden. See `usePageVisibility()` and `POLLING_INTERVALS` in `src/lib/config.ts`.
- **Games list** (e.g. `/games`, GameGrid): `GAMES_LIST_REFRESH_MS` (15s) when visible; 30s when hidden. Manual "Refresh" buttons on header (leaderboard) and Game History page.
- Auto-tick runs only when tab is visible (`AUTO_TICK_MS` 5s). Mid-processing ticks return instantly because the DB claim is held.

## Non-Obvious Implementation Details

- AI responses are parsed with multiple fallback strategies in `parseAIResponse()`
- The "judge" layer validates moves against chess.js, may restrict to engine candidates, and may warn-and-retry on blunders before applying
- Game processing is designed to be resilient to concurrent ticks via the DB claim
- ELO calculations use standard K-factor of 32 with default rating of 1500
- Seeded models (July 2026): active Groq gpt-oss / Qwen 3.6 and Gemini 3.x (+ 2.5 legacy); Anthropic and OpenAI models seeded inactive until keys are set
