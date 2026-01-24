/**
 * AI Request Timeouts
 * 
 * Groq: 7s - Fast models, typically respond in 2-3s
 * Gemini: 15s - Slower initial response, but streaming helps
 * Gateway: 8s - Other providers via AI SDK
 */
export const AI_TIMEOUTS = {
  GROQ_MS: 7_000,
  GEMINI_MS: 15_000,
  GATEWAY_MS: 8_000,
} as const;

/**
 * Game Rules
 * 
 * MAX_JUDGE_ATTEMPTS: Number of chances to correct illegal move
 * MAX_TIMEOUT_WARNINGS: Consecutive timeouts before forfeit
 * GAME_TIME_LIMIT_MS: Maximum game duration (25 minutes)
 */
export const GAME_RULES = {
  MAX_JUDGE_ATTEMPTS: 3,
  MAX_TIMEOUT_WARNINGS: 2,
  GAME_TIME_LIMIT_MS: 25 * 60 * 1000,
} as const;

/**
 * ELO Rating System
 * 
 * K_FACTOR: Rating change multiplier (32 is standard for chess)
 */
export const ELO_CONFIG = {
  K_FACTOR: 32,
  DEFAULT_RATING: 1500,
} as const;

/**
 * UI Polling Intervals
 * 
 * GAME_REFRESH_MS: How often to refresh active game
 * LEADERBOARD_REFRESH_MS: How often to refresh leaderboard
 * AUTO_TICK_MS: How often to auto-tick active games
 */
export const POLLING_INTERVALS = {
  GAME_REFRESH_MS: 2_000,
  LEADERBOARD_REFRESH_MS: 5_000,
  AUTO_TICK_MS: 3_000,
} as const;