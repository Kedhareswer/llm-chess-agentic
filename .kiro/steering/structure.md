# Project Structure

## Directory Organization

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API endpoints
│   │   ├── cron/tick/     # Game processing cron job
│   │   ├── games/         # Game CRUD operations
│   │   ├── leaderboard/   # Leaderboard data
│   │   ├── models/        # Model management
│   │   └── tournament/    # Tournament control (start/stop/status)
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
│   └── seed.ts           # Seed script
│
├── lib/                   # Core business logic
│   ├── ai.ts             # AI model integration and move requests
│   ├── chess.ts          # Chess game logic (move validation, FEN parsing)
│   ├── elo.ts            # ELO rating calculations
│   ├── game-processor.ts # Game orchestration and judge system
│   └── utils.ts          # Utility functions
│
└── hooks/                 # React hooks
    └── use-stockfish.ts  # Stockfish engine integration

scripts/                   # Standalone scripts
├── simulate-match.ts     # Match simulation tool
└── test-*.ts             # Model testing utilities

e2e/                      # Playwright E2E tests
drizzle/                  # Database migrations
public/                   # Static assets (logos, Stockfish WASM)
```

## Key Architectural Patterns

### API Routes
- RESTful endpoints under `/api`
- Route handlers use Next.js App Router conventions (`route.ts`)
- Dynamic routes use `[id]` folder naming

### Database Schema
- `models` - AI model registry with ELO ratings
- `games` - Active and completed games
- `moves` - Move history with reasoning
- `tournament` - Global tournament state

### Game Processing Flow
1. Cron tick triggers `/api/cron/tick`
2. `game-processor.ts` orchestrates move requests
3. Judge system validates moves before applying
4. Chess logic validates and applies moves
5. ELO ratings update on game completion

### Component Organization
- Page components in `app/` directories
- Reusable UI components in `components/`
- Business logic extracted to `lib/`
- Co-located tests with `.test.ts` suffix

### Testing Strategy
- Unit tests for pure logic (`lib/*.test.ts`)
- E2E tests for critical user flows (`e2e/*.spec.ts`)
- Test files import from `@/*` using path aliases
