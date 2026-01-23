import { describe, it, expect } from "vitest";
import { buildPrompt, parseAIResponse } from "./ai";

describe("AI utilities", () => {
  it("builds chess prompt", () => {
    const prompt = buildPrompt({
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      color: "black",
      legalMoves: ["e5", "e6", "Nf6"],
      lastMoves: ["e4"],
    });

    expect(prompt).toContain("black");
    expect(prompt).toContain("e5, e6, Nf6");
    expect(prompt).toContain("e4");
  });

  it("parses valid AI response", () => {
    const response = '{"move": "e5", "reasoning": "Control the center"}';
    const result = parseAIResponse(response);
    expect(result).toEqual({ move: "e5", reasoning: "Control the center" });
  });

  it("returns null for invalid JSON", () => {
    const result = parseAIResponse("not json");
    expect(result).toBeNull();
  });

  it("extracts move from incomplete JSON with fallback reasoning", () => {
    // New behavior: parser extracts moves even from incomplete JSON to prevent forfeits
    const result = parseAIResponse('{"move": "e5"}');
    expect(result).not.toBeNull();
    expect(result?.move).toBe("e5");
  });

  it("extracts move from natural language", () => {
    const result = parseAIResponse("I will play e4 to control the center");
    expect(result).not.toBeNull();
    expect(result?.move).toBe("e4");
  });

  it("handles markdown code blocks", () => {
    const response = '```json\n{"move": "Nf3", "reasoning": "Develop knight"}\n```';
    const result = parseAIResponse(response);
    expect(result).toEqual({ move: "Nf3", reasoning: "Develop knight" });
  });

  it("returns null for completely invalid input", () => {
    const result = parseAIResponse("hello world no moves here");
    expect(result).toBeNull();
  });
});
