# Architecture Overview

This document describes the architecture of the LLM Chess Tournament system.

## System Components

### Frontend
- **Framework**: Next.js 16 with App Router
- **UI Library**: Tailwind CSS for styling
- **State Management**: React hooks for local state, API calls for remote data
- **Data Fetching**: Server-side rendering and client-side API calls

### Backend
- **API Layer**: Next.js API routes in the App Router
- **Business Logic**: Game processing, AI communication, ELO calculations
- **Database Layer**: Drizzle ORM with PostgreSQL

### AI Integration
- **Multi-Provider Support**: Groq, Google Gemini, and other providers via AI SDK
- **Streaming Responses**: Real-time move generation with early termination
- **Validation Layer**: Move validation against chess rules

## Core Modules

### Game Processing
The game processor ([src/lib/game-processor.ts](file:///c/Users/mbkhn/Downloads/Inspired/llm-chess/src/lib/game-processor.ts)) manages the lifecycle of chess games:

1. Fetches active games from the database
2. Determines whose turn it is based on the FEN
3. Requests moves from the appropriate AI model
4. Validates the move against chess rules
5. Updates the game state in the database
6. Handles game completion and ELO updates

### AI Communication
The AI module ([src/lib/ai.ts](file:///c/Users/mbkhn/Downloads/Inspired/llm-chess/src/lib/ai.ts)) handles communication with various LLM providers:

- **Request Building**: Creates prompts based on the current game state
- **Response Parsing**: Extracts moves from AI responses using multiple strategies
- **Error Handling**: Manages API key errors, rate limits, and timeouts
- **Streaming**: Supports streaming responses for faster feedback

### Chess Logic
The chess module ([src/lib/chess.ts](file:///c/Users/mbkhn/Downloads/Inspired/llm-chess/src/lib/chess.ts)) wraps the chess.js library:

- **Move Validation**: Ensures moves are legal according to chess rules
- **Position Updates**: Applies moves and updates the FEN
- **Game State**: Detects checkmate, stalemate, and other end conditions
- **Legal Moves**: Generates all legal moves from a given position

### Database Schema
The database schema is defined in [src/db/schema.ts](file:///c/Users/mbkhn/Downloads/Inspired/llm-chess/src/db/schema.ts):

- **models**: Stores AI model information and performance metrics
- **games**: Tracks ongoing and completed games with positions and status
- **moves**: Records individual moves with reasoning and timestamps
- **tournament**: Manages global tournament state and settings

## Error Handling Architecture

The system implements a comprehensive error handling architecture:

### Error Types
- `APIKeyError`: Problems with API authentication
- `RateLimitError`: Exceeded API rate limits
- `TimeoutError`: Operations taking too long
- `ParseError`: Issues parsing AI responses
- `InvalidMoveError`: Illegal chess moves

### Error Propagation
1. Errors are thrown with typed error classes
2. Higher-level functions catch specific error types
3. Transient errors (timeouts, parsing) lead to retry mechanisms
4. Fatal errors (API keys, rate limits) terminate the game

### Game Continuation Logic
- **Timeouts**: Up to 2 warnings before forfeit
- **Invalid Moves**: Returned to AI with correction request
- **API Failures**: Game cancellation with appropriate result

## Configuration Management

The system uses centralized configuration in [src/lib/config.ts](file:///c/Users/mbkhn/Downloads/Inspired/llm-chess/src/lib/config.ts):

- **AI Timeouts**: Provider-specific timeout values
- **Game Rules**: Maximum judge attempts, time limits
- **ELO Settings**: Calculation parameters
- **Polling Intervals**: UI refresh rates

## Deployment Architecture

### Environment Variables
- Database connection string
- API keys for different providers
- Optional AI gateway configuration

### Scaling Considerations
- Database connection pooling
- API rate limiting and caching
- Efficient game processing scheduling

## Security Considerations

- API keys stored in environment variables
- Input validation for all user inputs
- SQL injection protection via ORM
- Rate limiting at the application level