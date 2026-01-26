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
- Vercel AI SDK (`ai` package) for streaming and gateway
- Provider SDKs: `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`
- Custom Groq integration with streaming API
- Zod for response validation

## Chess Engine
- chess.js for game logic and move validation
- react-chessboard for UI visualization
- Stockfish WASM for position evaluation

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
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `GROQ_API_KEY` - Groq API key for llama models
- `GEMINI_API_KEY` - Google Gemini API key
- `AI_GATEWAY_API_KEY` - Optional Vercel AI Gateway key (falls back to OIDC)

## Path Aliases
- `@/*` maps to `./src/*` for clean imports
