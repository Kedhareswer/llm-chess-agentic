# Tech Stack

## Framework & Runtime
- Next.js 16 (App Router)
- React 19
- TypeScript 5 (strict mode enabled)
- Node.js target: ES2017

## Database & ORM
- PostgreSQL (via Neon serverless)
- Drizzle ORM for schema and queries
- Database migrations in `drizzle/` directory

## AI Integration
- Vercel AI SDK (`ai` package)
- Provider SDKs: `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`
- Direct adapters use non-streaming `generateText` for Groq (OpenAI-compatible baseURL), Google Gemini, Anthropic, and OpenAI
- Gemini 3+ passes `thinkingConfig.thinkingLevel: "low"`; larger `maxOutputTokens` for thinking models
- Unrecognized model ids fall through to AI Gateway via `streamText`
- Zod for response validation
- Timeouts (`AI_TIMEOUTS`): Groq 7s, Gemini 30s, Anthropic 20s, OpenAI 20s, Gateway 8s

## Chess Engine
- chess.js for game logic and move validation
- `src/lib/engine.ts` — depth-2 material negamax + positional opening tiebreak (skill modes)
- react-chessboard for UI visualization
- Stockfish WASM for live eval bar and post-game accuracy analysis

## UI & Styling
- Tailwind CSS 4
- Radix UI components (dialog, slot)
- shadcn/ui component patterns
- Lucide React for icons

## Testing
- Vitest for unit tests
- Playwright for E2E tests
- Test files use `.test.ts` suffix and co-locate with source

## Common Commands

```bash
# Development
pnpm dev              # Start dev server on localhost:3000

# Build & Deploy
pnpm build            # Production build
pnpm start            # Start production server

# Database
pnpm db:push          # Push schema changes to database
pnpm db:seed          # Seed database with initial data
pnpm db:setup         # Push + seed (full setup)

# Testing
pnpm test             # Run unit tests (single run)
pnpm test:watch       # Run unit tests in watch mode
pnpm test:e2e         # Run Playwright E2E tests

# Code Quality
pnpm lint             # Run ESLint
pnpm typecheck        # tsc --noEmit
```

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `GROQ_API_KEY` — Groq API key
- `GEMINI_API_KEY` — Google Gemini API key
- `ANTHROPIC_API_KEY` — Anthropic (Claude) API key
- `OPENAI_API_KEY` — Direct OpenAI API key
- `AI_GATEWAY_API_KEY` — Optional Vercel AI Gateway key (falls back to OIDC)
- `ADMIN_TOKEN` — Bearer token for reset / global key routes (required in production)
- `ENCRYPTION_KEY` — Optional; encrypts API keys at rest

## Path Aliases
- `@/*` maps to `./src/*` for clean imports
