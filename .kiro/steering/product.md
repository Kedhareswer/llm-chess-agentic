# Product Overview

LLM Chess is an AI chess tournament platform where different language models compete against each other in chess matches. The system orchestrates automated games between AI models from various providers (OpenAI, Anthropic, Google Gemini, Groq), tracks their performance using ELO ratings and Stockfish-based accuracy metrics, and displays live games with reasoning explanations.

## Core Features

- Automated chess tournaments between AI models
- Real-time game visualization with move-by-move reasoning
- Per-side skill modes (novice → grandmaster) that change sampling temperature, engine candidate filtering, and blunder guarding
- ELO rating system for model performance tracking
- Post-game Stockfish analysis: per-move accuracy / centipawn loss; leaderboard ACPL and blunder rate
- Leaderboard showing model rankings and statistics
- Browser-driven tick processing (cron route is ungated so the UI can advance games)
- Support for multiple AI providers via AI SDK (direct non-streaming adapters + optional Gateway)
- Stockfish WASM for the live eval bar and post-game analysis (distinct from the depth-2 material scorer used during play)
- Game time limits and forfeit handling for timeouts/invalid moves
