/**
 * Error handling classes for LLM Chess application
 * 
 * This module provides a hierarchy of typed error classes for better error
 * categorization and handling throughout the application.
 */

/**
 * Base error class for all chess-related errors
 */
export class ChessError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when API key is invalid or missing
 */
export class APIKeyError extends ChessError {
  public readonly statusCode?: number;

  constructor(provider: string, statusCode?: number) {
    super(
      `Invalid or missing API key for ${provider}`,
      'API_KEY_ERROR'
    );
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends ChessError {
  public readonly retryAfter?: number;

  constructor(provider: string, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${provider}`,
      'RATE_LIMIT_ERROR'
    );
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends ChessError {
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(
      `${operation} timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR'
    );
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when an invalid chess move is attempted
 */
export class InvalidMoveError extends ChessError {
  public readonly move: string;
  public readonly legalMoves: string[];

  constructor(move: string, legalMoves: string[]) {
    super(
      `Invalid move "${move}". Legal moves: ${legalMoves.join(', ')}`,
      'INVALID_MOVE_ERROR'
    );
    this.move = move;
    this.legalMoves = legalMoves;
  }
}

/**
 * Error thrown when AI response cannot be parsed
 */
export class ParseError extends ChessError {
  public readonly response: string;

  constructor(response: string) {
    super(
      'Failed to parse AI response',
      'PARSE_ERROR'
    );
    this.response = response;
  }
}
