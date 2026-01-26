# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project-Specific Commands

- Database operations: `pnpm db:push` (schema changes), `pnpm db:seed` (populate data), `pnpm db:setup` (both)
- Testing: `pnpm test` (unit tests with Vitest), `pnpm test:e2e` (Playwright end-to-end tests)
- Development scripts in `/scripts/` directory for model testing and simulation

## Critical Architecture Patterns

### Game Processing System
- Games are processed via `/api/cron/tick` endpoint which calls `processGame()` in `src/lib/game-processor.ts`
- Processing uses a locking mechanism (`processingGames` Map) to prevent race conditions
- Games have a 25-minute hard time limit enforced in `GAME_RULES.GAME_TIME_LIMIT_MS`
- Each side gets 2 timeout warnings before forfeit (tracked in `whiteTimeoutWarnings`/`blackTimeoutWarnings`)

### AI Integration
- Non-streaming API calls are used for all providers (more reliable than streaming for short JSON responses)
- Provider-specific timeouts: Groq (7s), Gemini (15s), Gateway (8s) - defined in `AI_TIMEOUTS`
- Models get up to 3 attempts to return a legal move (`MAX_JUDGE_ATTEMPTS`)
- API keys can be set globally or per-game (stored in `games.groqApiKey`/`games.geminiApiKey`)

### Error Handling
- Custom error hierarchy in `src/lib/errors.ts` with typed error classes
- Fatal errors (API key, rate limit) immediately end games
- Transient errors (timeout, parse) trigger warnings and retries
- All errors are caught and logged but don't crash the tick processor

## Database Schema Specifics

- Games table stores FEN positions and tracks timeout warnings per player
- Moves table includes AI reasoning for each move
- Tournament table has a single row with id=1 (singleton pattern)
- Models table tracks ELO ratings and game statistics

## Testing Requirements

- Unit tests use Vitest with setup file at `tests/setup.ts`
- Test database requires `TEST_DATABASE_URL` environment variable
- E2E tests use Playwright with automatic server startup
- Database tests run migrations and truncate tables between tests

## Configuration Management

- Centralized config in `src/lib/config.ts` with constants for timeouts, game rules, ELO, and polling
- Environment variables: `DATABASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `AI_GATEWAY_API_KEY`
- Drizzle config reads from `.env.local` (not standard `.env`)

## Non-Obvious Implementation Details

- AI responses are parsed with multiple fallback strategies in `parseAIResponse()`
- The "judge" layer validates moves against chess.js before applying them
- Game processing is designed to be resilient to concurrent ticks
- ELO calculations use standard K-factor of 32 with default rating of 1500
- Auto-tick interval is 8 seconds (increased from 3s to avoid race conditions)