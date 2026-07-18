# LLM Chess Tournament

A chess tournament system powered by Large Language Models (LLMs), featuring automated gameplay between different AI models.

## Features

- Automated chess games between LLMs from **Groq**, **Google Gemini**, **Anthropic**, and **OpenAI** (plus optional AI Gateway for other ids)
- Per-side **skill modes** (novice → grandmaster) that change temperature, candidate filtering, and blunder guarding
- ELO rating system to track model performance
- Post-game **Stockfish analysis**: per-move accuracy / centipawn loss, plus leaderboard ACPL and blunder rate
- Real-time tournament management and interactive game viewer with move-by-move reasoning
- Live Stockfish eval bar during play
- Configurable timeouts, tick budget, and polling intervals

## Architecture

The application is built with:
- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Next.js App Router API routes
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: AI SDK — non-streaming `generateText` for Groq / Google / Anthropic / OpenAI; Gateway `streamText` fallback
- **Chess**: chess.js for rules; tiny depth-2 engine scorer for skill modes; Stockfish WASM for eval / post-game analysis

## Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Set up environment variables in `.env.local`:
   ```
   DATABASE_URL=your_postgres_connection_string
   GROQ_API_KEY=your_groq_key
   GEMINI_API_KEY=your_gemini_key
   ANTHROPIC_API_KEY=your_anthropic_key   # optional until Claude models are enabled
   OPENAI_API_KEY=your_openai_key         # optional until GPT models are enabled
   AI_GATEWAY_API_KEY=your_ai_gateway_key # optional
   ADMIN_TOKEN=your_admin_token           # required in production for reset / global key routes
   ENCRYPTION_KEY=...                     # optional; encrypts API keys at rest
   ```
4. Run database setup: `pnpm db:setup` (or `pnpm db:push` then `pnpm db:seed`)
5. Start the development server: `pnpm dev`

Seeded models (July 2026): active Groq (gpt-oss, Qwen 3.6) and Gemini 3.x (+ 2.5 legacy); Anthropic and OpenAI entries are inactive until you set keys and toggle them on.

## Error Handling

The application implements comprehensive error handling with typed error classes:

- `APIKeyError`: Thrown when API keys are invalid or missing
- `RateLimitError`: Thrown when rate limits are exceeded
- `TimeoutError`: Thrown when operations time out
- `ParseError`: Thrown when AI responses cannot be parsed
- `InvalidMoveError`: Thrown when invalid chess moves are attempted

These errors are caught and handled appropriately throughout the application, with game continuation logic for transient issues and game termination for fatal errors.

## Development Scripts

- Database: `pnpm db:push`, `pnpm db:seed`, `pnpm db:setup`
- Tests: `pnpm test`, `pnpm test:watch`, `pnpm test:e2e`, `pnpm typecheck`
- Ad-hoc utilities live under `scripts/` (run with `pnpm exec tsx scripts/<name>.ts` as needed)

## Configuration

Centralized in `src/lib/config.ts`:

- `AI_TIMEOUTS`: Groq 7s, Gemini 30s, Anthropic 20s, OpenAI 20s, Gateway 8s
- `GAME_RULES`: max judge attempts (3), timeout warnings (2), game time limit (25 min), `TICK_BUDGET_MS` (25s multi-ply budget per tick)
- `ELO_CONFIG`: K factor 32, default rating 1500
- `POLLING_INTERVALS`: game refresh 1s, games list 15s, completed game 60s, auto-tick 5s, tab hidden 30s

## API Routes

Key endpoints:

- `POST /api/games/start` — start a game (`modelIds`, optional `whiteMode`/`blackMode`, optional per-game keys). Ungated.
- `POST /api/games/destroy` — archive the active game as complete (does not hard-delete). Ungated.
- `POST /api/games/[id]/analysis` — persist Stockfish evals into move columns and set `analyzed`
- `GET /api/analytics/accuracy` — per-model ACPL / accuracy / blunder rate aggregates
- `GET|POST /api/cron/tick` — process active games (intentionally ungated; browser-driven)
- `POST /api/tournament/reset`, `.../groq-key`, `.../gemini-key` — require `Authorization: Bearer $ADMIN_TOKEN` when configured
- `/api/games/bulk`, `/api/leaderboard`, `/api/tournament/*` — read / control surfaces

## Database Schema

PostgreSQL tables (see `src/db/schema.ts`):

- `models` — id, name, provider, ELO, win/loss/draw stats, active flag
- `games` — players, FEN/PGN, status/result, timeout warnings, `white_mode`/`black_mode`, processing claim (`processing` / `processing_started_at`), `analyzed`, optional encrypted API keys
- `moves` — SAN, FEN after, reasoning, color; nullable post-analysis `eval_cp` / `cp_loss` / `move_accuracy` (no annotation column)
- `tournament` — singleton (id=1): run state, tick counters, global API keys

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

See `docs/ROADMAP.md` for prioritized fixes and features.

## Running Tests

```bash
pnpm test
pnpm test:e2e
```

## License

MIT
