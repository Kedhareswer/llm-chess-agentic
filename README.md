# LLM Chess Tournament

A chess tournament system powered by Large Language Models (LLMs), featuring automated gameplay between different AI models.

## Features

- Automated chess games between various LLMs (Groq, Google Gemini, OpenAI, etc.)
- ELO rating system to track model performance
- Real-time tournament management
- Interactive game viewer with move-by-move analysis
- Configurable game settings and timeouts

## Architecture

The application is built with:
- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Next.js App Router API routes
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: AI SDK with support for multiple providers
- **Chess Engine**: chess.js for game logic

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env.local`:
   ```
   DATABASE_URL=your_postgres_connection_string
   GROQ_API_KEY=your_groq_key
   GEMINI_API_KEY=your_gemini_key
   AI_GATEWAY_API_KEY=your_ai_gateway_key # optional
   ```
4. Run database migrations: `npx drizzle-kit push`
5. Start the development server: `npm run dev`

## Error Handling

The application implements comprehensive error handling with typed error classes:

- `APIKeyError`: Thrown when API keys are invalid or missing
- `RateLimitError`: Thrown when rate limits are exceeded
- `TimeoutError`: Thrown when operations time out
- `ParseError`: Thrown when AI responses cannot be parsed
- `InvalidMoveError`: Thrown when invalid chess moves are attempted

These errors are caught and handled appropriately throughout the application, with game continuation logic for transient issues and game termination for fatal errors.

## Development Scripts

The project includes several utility scripts for development and testing:

- `npm run simulate`: Runs the simulation script to test games between models
- `npm run list-models`: Lists available models from API providers
- `npm run healthcheck`: Checks the health of configured AI providers

## Configuration

The application uses centralized configuration in `src/lib/config.ts`:

- `AI_TIMEOUTS`: Timeout values for different AI providers (GROQ: 7s, GEMINI: 15s, GATEWAY: 8s)
- `GAME_RULES`: Game rules including max judge attempts (3) and game time limit (25 minutes)
- `ELO_CONFIG`: ELO calculation parameters (K factor: 32, default rating: 1500)
- `POLLING_INTERVALS`: UI refresh intervals (game: 2s, leaderboard: 5s, auto-tick: 3s)

## API Routes

Key API endpoints include:

- `/api/games/start`: Start new games between specified models
- `/api/games/bulk`: Fetch multiple games with associated model data
- `/api/cron/tick`: Process active games (typically called by scheduler)
- `/api/tournament/*`: Manage tournament settings and API keys

## Database Schema

The application uses a PostgreSQL database with the following main tables:

- `models`: Stores AI model information (name, provider, ELO rating, stats)
- `games`: Tracks ongoing and completed games (players, status, FEN, result)
- `moves`: Records all moves in each game (position, reasoning, timing)
- `tournament`: Manages overall tournament state and settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Running Tests

To run the test suite:

```bash
npm test
```

## License

MIT