# Architecture Overview

This document describes the architecture of the LLM Chess Tournament system.

## System Components

### Frontend
- **Framework**: Next.js 16 with App Router
- **UI Library**: Tailwind CSS for styling
- **State Management**: React hooks for local state, API calls for remote data
- **Data Fetching**: Server-side rendering and client-side API calls; visibility-aware polling (`POLLING_INTERVALS`)

### Backend
- **API Layer**: Next.js API routes in the App Router
- **Business Logic**: Game processing, AI communication, skill modes, ELO, post-game analysis math
- **Database Layer**: Drizzle ORM with PostgreSQL

### AI Integration
- **Direct providers** (non-streaming `generateText`): Groq, Google Gemini, Anthropic, OpenAI — keyed by model id prefix (`groq/`, `google/`, `anthropic/`, `openai/`)
- **AI Gateway fallback** (`streamText` + early parse) for unrecognized prefixes; optional `AI_GATEWAY_API_KEY` / Vercel OIDC
- **Gemini specifics**: 3+ models use `providerOptions.google.thinkingConfig.thinkingLevel: "low"` and a larger output budget; 2.x omit thinking options
- **Validation Layer**: Judge in `game-processor` validates against chess.js, optional engine candidate lists, and blunder guards

## Core Modules

### Game Processing
The game processor ([src/lib/game-processor.ts](../src/lib/game-processor.ts)) manages the lifecycle of chess games:

1. Atomically **claims** the game (`UPDATE` `processing` / `processingStartedAt`) so overlapping ticks cannot double-move
2. Plays plies in a loop until the game ends, a ply fails, or `TICK_BUDGET_MS` (25s) is spent
3. Resolves skill mode from `whiteMode` / `blackMode` and scores legal moves with the engine scorer
4. Requests a move from the side-to-move model (with judge retries)
5. Validates and applies the move; updates FEN/PGN/moves
6. On completion, updates ELO; releases the processing claim
7. Separately, completed games may be analyzed client-side (Stockfish) and persisted via the analysis API

### Skill Modes
Defined in [src/lib/modes.ts](../src/lib/modes.ts). Modes: `novice`, `apprentice`, `scholar` (default), `strategist`, `virtuoso`, `grandmaster`. Each sets:

| Knob | Role |
|------|------|
| `temperature` | Sampling temperature for the provider call |
| `candidateLimit` | If set, model must pick from top-N engine-scored moves |
| `blunderThresholdCp` | If set, one warn-and-retry when loss vs best ≥ threshold |
| `persona` | Prompt personality string |

Persisted per game as `games.white_mode` / `games.black_mode` (migration `0008`).

### Engine Scorer
[src/lib/engine.ts](../src/lib/engine.ts) — depth-2 material-only negamax with alpha-beta, capture/promotion move ordering, `MATE_SCORE`, and a small positional opening **tiebreak** (center / development / castling) so quiet positions are not arbitrarily ordered. Used to ground skill modes; **not** Stockfish.

### AI Communication
The AI module ([src/lib/ai.ts](../src/lib/ai.ts)) handles communication with LLM providers:

- **Request Building**: Prompts include board ASCII, material, PGN, persona, and optional scored candidates
- **Response Parsing**: Multiple fallback strategies via `parseAIResponse()`
- **Error Handling**: Typed `APIKeyError` / `RateLimitError` / `TimeoutError` / `ParseError`
- **Transport**: Non-streaming for the four direct providers; Gateway path streams

### Chess Logic
The chess module ([src/lib/chess.ts](../src/lib/chess.ts)) wraps chess.js:

- **Move Validation**: Ensures moves are legal
- **Position Updates**: Applies moves and updates FEN / PGN (including correct PGN load for game-over detection)
- **Game State**: Checkmate, stalemate, draws
- **Legal Moves**: Generates all legal moves from a position

### Post-Game Analysis
- Math: [src/lib/analysis.ts](../src/lib/analysis.ts) — per-move `cpLoss` / accuracy; aggregates ACPL / blunder rate
- Client: Stockfish worker (`use-game-analysis` / `use-stockfish`) evaluates plies, then `POST /api/games/[id]/analysis`
- Persists `moves.eval_cp`, `moves.cp_loss`, `moves.move_accuracy` and sets `games.analyzed`
- Leaderboard rolls up via `/api/analytics/accuracy` (ACPL and blunder rate are **aggregates**, not stored columns)
- There is **no** `annotation` column (NAG symbols remain a roadmap item)

### Database Schema
Defined in [src/db/schema.ts](../src/db/schema.ts):

- **models**: AI model registry, provider, ELO, stats, active flag
- **games**: Players, FEN/PGN, status/result, timeout warnings, `whiteMode`/`blackMode`, processing claim, `analyzed`, optional API keys
- **moves**: SAN, fenAfter, reasoning, color; nullable `evalCp` / `cpLoss` / `moveAccuracy`
- **tournament**: Singleton (id=1) run state, tick counters, global API keys

`publicGameColumns` omits per-game API keys and the internal processing claim from client payloads.

## Error Handling Architecture

### Error Types
- `APIKeyError`: Problems with API authentication
- `RateLimitError`: Exceeded API rate limits
- `TimeoutError`: Operations taking too long
- `ParseError`: Issues parsing AI responses
- `InvalidMoveError`: Illegal chess moves

### Error Propagation
1. Errors are thrown with typed error classes
2. Higher-level functions catch specific error types
3. Transient errors (timeouts, parsing) lead to retry / timeout-warning mechanisms
4. Fatal errors (API keys, rate limits) terminate the game

### Game Continuation Logic
- **Timeouts**: Up to 2 warnings before forfeit
- **Invalid Moves / blunders**: Returned to AI with correction context (judge)
- **API Failures**: Game cancellation with appropriate result

## Configuration Management

Centralized in [src/lib/config.ts](../src/lib/config.ts):

- **AI Timeouts**: Groq 7s, Gemini 30s, Anthropic 20s, OpenAI 20s, Gateway 8s
- **Game Rules**: Max judge attempts (3), timeout warnings (2), 25-minute TTL, `TICK_BUDGET_MS` 25s
- **ELO Settings**: K=32, default 1500
- **Polling Intervals**: Game 1s, games list 15s, completed 60s, auto-tick 5s, tab hidden 30s

## Auth

- [src/lib/auth.ts](../src/lib/auth.ts): `requireAdmin` / `requireCron`
- Admin bearer token gates tournament reset and global Groq/Gemini key updates
- `requireCron` exists but is **unused**; tick is intentionally ungated for browser-driven play
- `games/start` and `games/destroy` are ungated; destroy **archives** the active game as complete (does not hard-delete)

## Deployment Architecture

### Environment Variables
- `DATABASE_URL`
- Provider keys: `GROQ_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- Optional: `AI_GATEWAY_API_KEY`, `ADMIN_TOKEN`, `ENCRYPTION_KEY`

### Scaling Considerations
- Serverless-safe processing claim (not an in-memory Map)
- Multi-ply tick budget under Vercel `maxDuration` (60s on the tick route)
- Visibility-aware polling to limit edge request volume

## Security Considerations

- API keys in env and optionally encrypted at rest in DB
- Admin-gated destructive / global-key routes when `ADMIN_TOKEN` is set
- Input validation (Zod) on start and related routes
- SQL injection protection via ORM
- Tick left open by design (advances already-active games only; serialized by DB claim)
