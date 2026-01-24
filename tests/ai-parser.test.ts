import { describe, it, expect } from 'vitest';
import { parseAIResponse } from '../src/lib/ai';

describe('AI Parser', () => {
  it('should parse simple move response', () => {
    const response = '{"move": "e4", "reasoning": "Standard opening move"}';
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "e4",
      reasoning: "Standard opening move"
    });
  });

  it('should parse response with only move field', () => {
    const response = '{"move": "Nf3"}';
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "Nf3",
      reasoning: "No reasoning provided"
    });
  });

  it('should handle responses with extra text before/after JSON', () => {
    const response = 'Here is my move: {"move": "d4", "reasoning": "Controlling center"} Thank you.';
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "d4",
      reasoning: "Controlling center"
    });
  });

  it('should handle JSON in code blocks', () => {
    const response = '```json\n{"move": "c5", "reasoning": "Sicilian Defense"}\n```';
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "c5",
      reasoning: "Sicilian Defense"
    });
  });

  it('should handle invalid responses', () => {
    const response = 'invalid response';
    const result = parseAIResponse(response);
    expect(result).toBeNull();
  });

  it('should handle empty responses', () => {
    const response = '';
    const result = parseAIResponse(response);
    expect(result).toBeNull();
  });

  it('should handle responses with natural language patterns', () => {
    const response = 'I will play e4 to control the center.';
    const result = parseAIResponse(response);
    expect(result).not.toBeNull();
    expect(result!.move).toMatch(/[a-h][1-8]|[KQRBN]?x?[a-h][1-8][+#]?|O-O(?:-O)?|0-0(?:-0)?/);
  });
});