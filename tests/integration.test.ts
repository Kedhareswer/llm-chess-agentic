import { describe, it, expect } from 'vitest';
import { 
  validateMove, 
  applyMove, 
  getLegalMoves, 
  getTurn, 
  isGameOver, 
  getGameResult,
  getMoveNumber,
  STARTING_FEN 
} from '../src/lib/chess';
import { parseAIResponse } from '../src/lib/ai';
import { APIKeyError, RateLimitError, TimeoutError, ParseError } from '../src/lib/errors';

describe('Integration Tests', () => {
  it('should validate, apply, and get turn correctly', () => {
    const fen = STARTING_FEN;
    expect(validateMove(fen, 'e4')).toBe(true);
    
    const result = applyMove(fen, 'e4');
    expect(result).not.toBeNull();
    expect(getTurn(result!.fen)).toBe('b');
  });

  it('should parse AI response and use in chess logic', () => {
    const aiResponse = '{"move": "e4", "reasoning": "Controlling the center"}';
    const parsed = parseAIResponse(aiResponse);
    
    expect(parsed).not.toBeNull();
    if (parsed) {
      const fen = STARTING_FEN;
      expect(validateMove(fen, parsed.move)).toBe(true);
      
      const result = applyMove(fen, parsed.move);
      expect(result).not.toBeNull();
    }
  });

  it('should handle error types properly', () => {
    const apiKeyError = new APIKeyError('Groq');
    const rateLimitError = new RateLimitError('OpenAI');
    const timeoutError = new TimeoutError('test', 5000);
    const parseError = new ParseError('test response');
    
    expect(apiKeyError).toBeInstanceOf(APIKeyError);
    expect(rateLimitError).toBeInstanceOf(RateLimitError);
    expect(timeoutError).toBeInstanceOf(TimeoutError);
    expect(parseError).toBeInstanceOf(ParseError);
    
    expect(apiKeyError.code).toBe('API_KEY_ERROR');
    expect(rateLimitError.code).toBe('RATE_LIMIT_ERROR');
    expect(timeoutError.code).toBe('TIMEOUT_ERROR');
    expect(parseError.code).toBe('PARSE_ERROR');
  });

  it('should handle chess game progression', () => {
    let fen = STARTING_FEN;
    expect(getTurn(fen)).toBe('w');
    
    // Apply a few moves
    const move1 = applyMove(fen, 'e4');
    expect(move1).not.toBeNull();
    fen = move1!.fen;
    expect(getTurn(fen)).toBe('b');
    
    const move2 = applyMove(fen, 'e5');
    expect(move2).not.toBeNull();
    fen = move2!.fen;
    expect(getTurn(fen)).toBe('w');
    
    const move3 = applyMove(fen, 'Nf3');
    expect(move3).not.toBeNull();
    fen = move3!.fen;
    expect(getTurn(fen)).toBe('b');
    
    // Check that game is not over yet
    expect(isGameOver(fen)).toBe(false);
    expect(getGameResult(fen)).toBeNull();
  });

  it('should get legal moves and validate them', () => {
    const fen = STARTING_FEN;
    const legalMoves = getLegalMoves(fen);
    
    expect(legalMoves.length).toBeGreaterThan(0);
    
    // All legal moves should be valid
    for (const move of legalMoves) {
      expect(validateMove(fen, move)).toBe(true);
    }
    
    // An illegal move should be rejected
    expect(validateMove(fen, 'e6')).toBe(false); // e6 is not a legal first move
  });
});