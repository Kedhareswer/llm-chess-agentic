# Project Structure

## Directory Organization

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints
│   │   ├── analytics/     # Aggregate accuracy / ACPL / blunder stats
│   │   ├── cron/tick/     # Game processing (browser-driven; intentionally ungated)
│   │   ├── games/         # Game CRUD, start/destroy, per-game analysis
│   │   ├── leaderboard/   # Leaderboard data
│   │   ├── models/        # Model management
│   │   └── tournament/    # Tournament control + admin-gated key/reset routes
│   ├── game/[id]/         # Individual game view page
│   ├── leaderboard/       # Leaderboard page
│   └── page.tsx           # Home page (game grid + leaderboard)
│
├── components/            # React components
│   ├── ui/               # Reusable UI primitives (shadcn/ui)
│   └── *.tsx             # Feature components (game-card, leaderboard, etc.)
│
├── db/                    # Database layer
│   ├── schema.ts         # Drizzle schema definitions
│   ├── index.ts          # Database client
│   └── seed.ts           # Seed script (July 2026 model lineup)
│
├── lib/                   # Core business logic
│   ├── ai.ts             # Provider adapters + prompts (generateText / Gateway streamText)
│   ├── analysis.ts       # Post-game cpLoss / accuracy / ACPL math
│   ├── auth.ts           # requireAdmin / requireCron helpers
│   ├── chess.ts          # Chess game logic (move validation, FEN/PGN)
│   ├── config.ts         # Timeouts, game rules, polling intervals
│   ├── crypto.ts         # Optional at-rest encryption for API keys
│   ├── elo.ts            # ELO rating calculations
│   ├── engine.ts         # Depth-2 material scorer for skill modes
│   ├── errors.ts         # Typed error hierarchy
│   ├── game-processor.ts # Game orchestration, DB claim, judge system
│   ├── modes.ts          # Skill mode configs (novice…grandmaster)
│   ├── api-key-store.ts  # Global key resolution
│   └── utils.ts          # Utility functions
│
└── hooks/                 # React hooks
    ├── use-stockfish.ts       # Live Stockfish eval bar
    ├── use-game-analysis.ts   # Post-game analysis runner
    └── use-game-data.ts       # Game + moves fetch / poll

scripts/                   # Standalone scripts
├── simulate-match.ts     # Match simulation tool
└── test-*.ts             # Model testing utilities

e2e/                      # Playwright E2E tests
drizzle/                  # Database migrations (incl. 0006 claim, 0007 analysis, 0008 modes)
public/                   # Static assets (logos, Stockfish WASM)
```

## Key Architectural Patterns

### API Routes
- RESTful endpoints under `/api`
- Route handlers use Next.js App Router conventions (`route.ts`)
- Dynamic routes use `[id]` folder naming

### Database Schema
- `models` — AI model registry with ELO ratings
- `games` — Active/completed games; skill modes; processing claim; analyzed flag
- `moves` — Move history with reasoning; optional eval/cpLoss/accuracy after analysis
- `tournament` — Global tournament state (singleton id=1)

### Game Processing Flow
1. Browser (or caller) hits `/api/cron/tick`
2. `processGame` atomically claims the game, then plays plies until `TICK_BUDGET_MS` or stop
3. Engine scores candidates; judge validates legality / mode constraints / blunders
4. Chess logic applies moves; ELO updates on completion
5. After completion, client Stockfish analysis may POST evals and set `analyzed`

### Component Organization
- Page components in `app/` directories
- Reusable UI components in `components/`
- Business logic extracted to `lib/`
- Co-located tests with `.test.ts` suffix

### Testing Strategy
- Unit tests for pure logic (`lib/*.test.ts`)
- E2E tests for critical user flows (`e2e/*.spec.ts`)
- Test files import from `@/*` using path aliases
