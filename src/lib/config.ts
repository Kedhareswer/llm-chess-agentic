/**
 * AI Request Timeouts
 * 
 * Groq: 7s - Fast models, typically respond in 2-3s
 * Gemini: 30s - Slower API with potential cold starts, needs more time for reliable responses
 * Gateway: 8s - Other providers via AI SDK
 */
export const AI_TIMEOUTS = {
  GROQ_MS: 7_000,
  GEMINI_MS: 30_000, // Increased from 15s to 30s to handle API slowness and cold starts
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
 * UI Polling Intervals (optimized for Vercel edge request quota)
 *
 * GAME_REFRESH_MS: Active game poll interval (visible tab)
 * GAMES_LIST_REFRESH_MS: Game history / bulk list poll (visible tab)
 * COMPLETED_GAME_REFRESH_MS: When game is complete, poll much less
 * AUTO_TICK_MS: Auto-tick active games (must be > typical processing time ~5s)
 * WHEN_TAB_HIDDEN_MS: Poll interval when tab is not visible
 */
export const POLLING_INTERVALS = {
  GAME_REFRESH_MS: 2_000, // Active game: poll every 2s so board feels snappy; refetch-after-tick gives instant update when tick runs
  GAMES_LIST_REFRESH_MS: 15_000,
  COMPLETED_GAME_REFRESH_MS: 60_000,
  AUTO_TICK_MS: 8_000,
  WHEN_TAB_HIDDEN_MS: 30_000,
} as const;