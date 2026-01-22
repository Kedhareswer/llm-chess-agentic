# LLM Chess Arena - Design Document

## Overview

A live chess tournament where AI models compete against each other, built for the AI Gateway Game Hackathon. Spectators watch multiple games simultaneously and can drill into individual matches to see each model's reasoning.

**Hackathon:** https://ai-gateway-game-hackathon.vercel.app/
**Deadline:** December 12, 2025 at 11:59 PM PST
**Category:** Simulation (autonomous AI competition)

## Requirements

### Hackathon Requirements
- Support automated head-to-head comparisons
- Include a "Start" button to launch competition rounds
- Deliver final ranked model performance lists
- Deploy on Vercel using AI Gateway + AI SDK

### Project Requirements
| Aspect | Decision |
|--------|----------|
| Eval focus | Raw chess ability + reasoning quality |
| Format | Arena continuous (rating-based matchmaking) |
| UI | Multi-game grid → click to expand (board + dual reasoning panels) |
| Models | Pre-selected 4-6 flagship (GPT-4, Claude, Gemini, etc.) |
| Tempo | Global 1-min ticker - all games advance together in parallel |
| Persistence | Fully persistent (PostgreSQL database) |

## Architecture

### Approach: Serverless Polling

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Vercel Cron │────▶│ API Routes   │────▶│ PostgreSQL  │
│ (1 min)     │     │ (game logic) │     │ (Neon)      │
└─────────────┘     └──────────────┘     └─────────────┘
                           ▲
                           │ poll every 5s
                    ┌──────┴──────┐
                    │   Browser   │
                    └─────────────┘
```

- **Ticker:** Vercel Cron job fires every minute, processes all active games in parallel
- **State:** PostgreSQL (Neon - Vercel's default)
- **Real-time:** Client polls every 5 seconds
- **Rationale:** Simplest path, fully within Vercel ecosystem, no external deps

## Data Model

### models
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | "gpt-4o", "claude-sonnet" |
| name | TEXT | Display name |
| provider | TEXT | "openai", "anthropic" |
| elo | INTEGER | Current rating (start 1500) |
| games_played | INTEGER | Total games |
| wins | INTEGER | |
| losses | INTEGER | |
| draws | INTEGER | |

### games
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PRIMARY KEY | |
| white_id | TEXT FK | Model playing white |
| black_id | TEXT FK | Model playing black |
| pgn | TEXT | Full game notation |
| fen | TEXT | Current board position |
| status | TEXT | "active", "complete" |
| result | TEXT | "1-0", "0-1", "1/2-1/2", null |
| started_at | TIMESTAMP | |
| ended_at | TIMESTAMP | |

### moves
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PRIMARY KEY | |
| game_id | UUID FK | |
| model_id | TEXT FK | Who made this move |
| move_number | INTEGER | 1, 2, 3... |
| move_san | TEXT | "e4", "Nf3", "O-O" |
| fen_after | TEXT | Position after move |
| reasoning | TEXT | Model's explanation |
| created_at | TIMESTAMP | |

### tournament
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Singleton (1 row) |
| status | TEXT | "stopped", "running" |
| tick_count | INTEGER | How many ticks so far |
| started_at | TIMESTAMP | |

## Game Engine

### Chess Logic
- Library: `chess.js`
- Validates all moves before accepting
- Generates legal moves list for AI context
- Detects checkmate, stalemate, draw conditions
- Produces FEN/PGN updates

### AI Move Request Flow

1. Build prompt with current FEN, move history, legal moves
2. Call AI Gateway via AI SDK with structured output
3. Parse JSON response: `{ "move": "Nf3", "reasoning": "..." }`
4. Validate move with chess.js
5. If illegal: retry with error feedback (up to 3 attempts)
6. If still failing: forfeit game

### Prompt Template
```
You are playing chess as {color} against another AI.

Current position (FEN): {fen}
Recent moves: {last_moves}
Legal moves: {legal_moves}

Analyze the position and choose your move.
Respond with JSON: {"move": "e4", "reasoning": "..."}
```

## Tournament Logic

### Ticker (Vercel Cron every 1 minute)

```typescript
async function tick() {
  if (tournament.status !== "running") return;

  const games = await db.getActiveGames();

  // Process all games in parallel
  await Promise.all(
    games.map(game => processGame(game))
  );

  // Then matchmake idle models
  await matchmake();

  await db.incrementTickCount();
}
```

### Matchmaking Algorithm
1. Find models not currently in an active game
2. If 2+ idle models exist:
   - Sort by ELO
   - Pair adjacent models (closest ratings)
   - Alternate who gets white
3. Create new game records

### ELO Update
```
K = 32
Expected = 1 / (1 + 10^((opponent_elo - player_elo) / 400))
New ELO = Old ELO + K * (actual - expected)

actual = 1 (win), 0.5 (draw), 0 (loss)
```

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/tournament/start | POST | Sets status = "running" |
| /api/tournament/stop | POST | Sets status = "stopped" |
| /api/tournament/reset | POST | Clears games, resets ELO |
| /api/tournament/state | GET | Current status, tick_count |
| /api/leaderboard | GET | Models sorted by ELO |
| /api/games | GET | Active games for grid view |
| /api/games/[id] | GET | Single game with moves + reasoning |
| /api/cron/tick | POST | Cron endpoint (secured) |

### Polling Strategy
- Client polls `/api/tournament/state` + `/api/games` every 5 seconds
- When viewing specific game, also poll `/api/games/[id]`

## Frontend

### Tech Stack
- Next.js 15 (App Router)
- shadcn/ui
- Tailwind CSS
- react-chessboard
- chess.js (shared with backend)

### Visual Style (nof1.ai inspired)
| Element | Style |
|---------|-------|
| Background | White |
| Borders | 2px black |
| Typography | Monospace, terminal-style |
| Buttons | Black fill on active, white on inactive |
| Corners | Sharp (no border-radius) |

### Layout

**Main View:**
```
┌─────────────────────────────────────────────────────────────┐
│ NAV: "LLM Chess Arena" | LIVE | LEADERBOARD    [Start][Stop]│
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────┐  ┌──────────────────┐ │
│  │     Game Grid (2x3)             │  │ LEADERBOARD      │ │
│  │     Click game to expand        │  │ 1. Claude  1623  │ │
│  │                                 │  │ 2. GPT-4o  1587  │ │
│  │     [Game] [Game] [Game]        │  │ TICK: 42         │ │
│  │     [Game] [Game] [Game]        │  │ STATUS: RUNNING  │ │
│  └─────────────────────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Game Detail Modal:**
```
┌─────────────────────────────────────────────────────────────┐
│ [X] Claude vs GPT-4o  •  Move 24                            │
├─────────────────┬───────────────────┬───────────────────────┤
│ CLAUDE (white)  │    Chess Board    │ GPT-4O (black)        │
│ ELO: 1623       │                   │ ELO: 1587             │
│                 │                   │                       │
│ Move 23: Qd4    │                   │ Move 22: Nf6          │
│ "Centralizing   │                   │ "Developing knight    │
│  the queen..."  │                   │  to attack e4..."     │
│                 │                   │                       │
│ [Move History]  │                   │ [Move History]        │
└─────────────────┴───────────────────┴───────────────────────┘
```

### Components
| Component | Responsibility |
|-----------|----------------|
| `<Header>` | Title, nav, Start/Stop/Reset buttons |
| `<Leaderboard>` | Sorted model list with ELO, W/L/D |
| `<GameGrid>` | Responsive grid of GameCard components |
| `<GameCard>` | Mini board, player names, click to expand |
| `<GameDetail>` | Modal with full board + dual reasoning panels |
| `<ChessBoard>` | Renders FEN using react-chessboard |
| `<ReasoningPanel>` | Scrollable move history with reasoning |

## Error Handling

| Scenario | Handling |
|----------|----------|
| AI returns illegal move | Retry with error context (up to 3 attempts) → forfeit |
| AI returns malformed JSON | Retry with JSON instruction (up to 3 attempts) → forfeit |
| AI API timeout | Retry immediately (up to 3 attempts) → forfeit |
| AI API rate limit | Exponential backoff (up to 5 attempts) → forfeit |
| AI API 500 error | Retry with backoff (up to 3 attempts) → forfeit |

**Key principle:** A model only loses through forfeit (repeated failures), never through skipped turns.

### Retry Logic
```typescript
async function getMove(modelId: string, fen: string, retries = 3): Promise<Move> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await callAI(modelId, fen);
      const { move, reasoning } = parseResponse(response);

      if (isLegalMove(fen, move)) {
        return { move, reasoning };
      }

      // Illegal move - retry with feedback
      fen = addErrorContext(fen, `"${move}" is illegal. Legal: ${getLegalMoves(fen)}`);

    } catch (error) {
      if (attempt < retries) {
        await sleep(1000 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw new ForfeitError(`${modelId} failed after ${retries} attempts`);
}
```

## Pre-selected Models

Initial set (can be adjusted):
1. GPT-4o (OpenAI)
2. Claude Sonnet 4 (Anthropic)
3. Gemini 1.5 Pro (Google)
4. Llama 3.1 70B (Meta via AI Gateway)
5. Mistral Large (Mistral)
6. Command R+ (Cohere)
