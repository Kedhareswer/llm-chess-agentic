import { describe, it, expect } from 'vitest';
import { parseAIResponse } from '../src/lib/ai';

describe('Real AI Responses', () => {
  it('should parse Groq-style response', () => {
    const response = `{"move": "e4", "reasoning": "Playing e4 to control the center squares d5 and f5, developing space for the light-squared bishop and queen."}`;
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "e4",
      reasoning: "Playing e4 to control the center squares d5 and f5, developing space for the light-squared bishop and queen."
    });
  });

  it('should parse Gemini-style response with code block', () => {
    const response = 'Here is my move:\n```json\n{\n  "move": "Nf3",\n  "reasoning": "Developing the knight to f3, attacking the center and preparing to castle kingside."\n}\n```';
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "Nf3",
      reasoning: "Developing the knight to f3, attacking the center and preparing to castle kingside."
    });
  });

  it('should parse response with extra text', () => {
    const response = 'After analyzing the position, I choose to play {"move": "d4", "reasoning": "Controlling the center with a pawn duo and preparing to develop pieces behind it."} This should give me a strong position.';
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "d4",
      reasoning: "Controlling the center with a pawn duo and preparing to develop pieces behind it."
    });
  });

  it('should handle response with markdown formatting', () => {
    const response = '```json\n{"move": "c5", "reasoning": "Playing the Sicilian Defense to challenge White\'s central control."}\n```';
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "c5",
      reasoning: "Playing the Sicilian Defense to challenge White's central control."
    });
  });

  it('should handle response with reasoning field named "reason"', () => {
    const response = '{"move": "e5", "reason": "Counterattacking in the center"}';
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "e5",
      reasoning: "Counterattacking in the center"
    });
  });

  it('should handle response with minimal content', () => {
    const response = '{"move": "Be7"}';
    const result = parseAIResponse(response);
    expect(result).toEqual({
      move: "Be7",
      reasoning: "No reasoning provided"
    });
  });
});