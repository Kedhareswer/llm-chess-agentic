import { describe, it, expect } from 'vitest';
import {
  ChessError,
  APIKeyError,
  RateLimitError,
  TimeoutError,
  InvalidMoveError,
  ParseError,
} from './errors';

describe('ChessError', () => {
  it('should create a base error with message and code', () => {
    const error = new ChessError('Test error', 'TEST_CODE');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ChessError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('ChessError');
  });

  it('should maintain proper stack trace', () => {
    const error = new ChessError('Test error', 'TEST_CODE');
    
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ChessError');
  });
});

describe('APIKeyError', () => {
  it('should create error with provider name', () => {
    const error = new APIKeyError('Groq');
    
    expect(error).toBeInstanceOf(ChessError);
    expect(error).toBeInstanceOf(APIKeyError);
    expect(error.message).toBe('Invalid or missing API key for Groq');
    expect(error.code).toBe('API_KEY_ERROR');
    expect(error.name).toBe('APIKeyError');
    expect(error.statusCode).toBeUndefined();
  });

  it('should include status code when provided', () => {
    const error = new APIKeyError('Google', 401);
    
    expect(error.message).toBe('Invalid or missing API key for Google');
    expect(error.statusCode).toBe(401);
  });

  it('should handle different providers', () => {
    const groqError = new APIKeyError('Groq', 403);
    const geminiError = new APIKeyError('Gemini', 401);
    
    expect(groqError.message).toContain('Groq');
    expect(geminiError.message).toContain('Gemini');
  });
});

describe('RateLimitError', () => {
  it('should create error with provider name', () => {
    const error = new RateLimitError('Groq');
    
    expect(error).toBeInstanceOf(ChessError);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.message).toBe('Rate limit exceeded for Groq');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.name).toBe('RateLimitError');
    expect(error.retryAfter).toBeUndefined();
  });

  it('should include retry after when provided', () => {
    const error = new RateLimitError('Google', 60);
    
    expect(error.message).toBe('Rate limit exceeded for Google');
    expect(error.retryAfter).toBe(60);
  });

  it('should handle different retry durations', () => {
    const shortError = new RateLimitError('Groq', 30);
    const longError = new RateLimitError('Groq', 300);
    
    expect(shortError.retryAfter).toBe(30);
    expect(longError.retryAfter).toBe(300);
  });
});

describe('TimeoutError', () => {
  it('should create error with operation and timeout', () => {
    const error = new TimeoutError('AI request for llama-3.3-70b', 7000);
    
    expect(error).toBeInstanceOf(ChessError);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.message).toBe('AI request for llama-3.3-70b timed out after 7000ms');
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.name).toBe('TimeoutError');
    expect(error.timeoutMs).toBe(7000);
  });

  it('should handle different timeout durations', () => {
    const groqError = new TimeoutError('Groq request', 7000);
    const geminiError = new TimeoutError('Gemini request', 15000);
    
    expect(groqError.timeoutMs).toBe(7000);
    expect(geminiError.timeoutMs).toBe(15000);
    expect(groqError.message).toContain('7000ms');
    expect(geminiError.message).toContain('15000ms');
  });
});

describe('InvalidMoveError', () => {
  it('should create error with move and legal moves', () => {
    const legalMoves = ['e2e4', 'e2e3', 'd2d4', 'd2d3'];
    const error = new InvalidMoveError('e2e5', legalMoves);
    
    expect(error).toBeInstanceOf(ChessError);
    expect(error).toBeInstanceOf(InvalidMoveError);
    expect(error.message).toBe('Invalid move "e2e5". Legal moves: e2e4, e2e3, d2d4, d2d3');
    expect(error.code).toBe('INVALID_MOVE_ERROR');
    expect(error.name).toBe('InvalidMoveError');
    expect(error.move).toBe('e2e5');
    expect(error.legalMoves).toEqual(legalMoves);
  });

  it('should handle empty legal moves list', () => {
    const error = new InvalidMoveError('e2e4', []);
    
    expect(error.message).toBe('Invalid move "e2e4". Legal moves: ');
    expect(error.legalMoves).toEqual([]);
  });

  it('should preserve legal moves array', () => {
    const legalMoves = ['Nf3', 'Nc3', 'e4'];
    const error = new InvalidMoveError('Nf6', legalMoves);
    
    expect(error.legalMoves).toEqual(legalMoves);
    expect(error.legalMoves.length).toBe(3);
  });
});

describe('ParseError', () => {
  it('should create error with response text', () => {
    const response = 'I think the best move is e4';
    const error = new ParseError(response);
    
    expect(error).toBeInstanceOf(ChessError);
    expect(error).toBeInstanceOf(ParseError);
    expect(error.message).toBe('Failed to parse AI response');
    expect(error.code).toBe('PARSE_ERROR');
    expect(error.name).toBe('ParseError');
    expect(error.response).toBe(response);
  });

  it('should handle JSON-like responses', () => {
    const response = '{"move": "e4", "reasoning": "Control center"}';
    const error = new ParseError(response);
    
    expect(error.response).toBe(response);
  });

  it('should handle malformed responses', () => {
    const response = '{invalid json';
    const error = new ParseError(response);
    
    expect(error.response).toBe(response);
    expect(error.message).toBe('Failed to parse AI response');
  });

  it('should handle empty responses', () => {
    const error = new ParseError('');
    
    expect(error.response).toBe('');
  });
});

describe('Error inheritance', () => {
  it('should allow instanceof checks for all error types', () => {
    const apiError = new APIKeyError('Groq');
    const rateError = new RateLimitError('Groq');
    const timeoutError = new TimeoutError('Request', 5000);
    const moveError = new InvalidMoveError('e5', ['e4']);
    const parseError = new ParseError('text');
    
    // All should be instances of ChessError
    expect(apiError).toBeInstanceOf(ChessError);
    expect(rateError).toBeInstanceOf(ChessError);
    expect(timeoutError).toBeInstanceOf(ChessError);
    expect(moveError).toBeInstanceOf(ChessError);
    expect(parseError).toBeInstanceOf(ChessError);
    
    // All should be instances of Error
    expect(apiError).toBeInstanceOf(Error);
    expect(rateError).toBeInstanceOf(Error);
    expect(timeoutError).toBeInstanceOf(Error);
    expect(moveError).toBeInstanceOf(Error);
    expect(parseError).toBeInstanceOf(Error);
  });

  it('should not be instances of other error types', () => {
    const apiError = new APIKeyError('Groq');
    
    expect(apiError).not.toBeInstanceOf(RateLimitError);
    expect(apiError).not.toBeInstanceOf(TimeoutError);
    expect(apiError).not.toBeInstanceOf(InvalidMoveError);
    expect(apiError).not.toBeInstanceOf(ParseError);
  });
});

describe('Error catching', () => {
  it('should be catchable as ChessError', () => {
    try {
      throw new APIKeyError('Groq');
    } catch (error) {
      expect(error).toBeInstanceOf(ChessError);
      if (error instanceof ChessError) {
        expect(error.code).toBe('API_KEY_ERROR');
      }
    }
  });

  it('should be catchable as specific error type', () => {
    try {
      throw new TimeoutError('Test operation', 1000);
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
      if (error instanceof TimeoutError) {
        expect(error.timeoutMs).toBe(1000);
      }
    }
  });

  it('should allow error type discrimination', () => {
    const errors: ChessError[] = [
      new APIKeyError('Groq'),
      new RateLimitError('Google'),
      new TimeoutError('Request', 5000),
      new InvalidMoveError('e5', ['e4']),
      new ParseError('text'),
    ];

    errors.forEach(error => {
      if (error instanceof APIKeyError) {
        expect(error.code).toBe('API_KEY_ERROR');
      } else if (error instanceof RateLimitError) {
        expect(error.code).toBe('RATE_LIMIT_ERROR');
      } else if (error instanceof TimeoutError) {
        expect(error.code).toBe('TIMEOUT_ERROR');
      } else if (error instanceof InvalidMoveError) {
        expect(error.code).toBe('INVALID_MOVE_ERROR');
      } else if (error instanceof ParseError) {
        expect(error.code).toBe('PARSE_ERROR');
      }
    });
  });
});
