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

  it("returns null for missing fields", () => {
    const result = parseAIResponse('{"move": "e5"}');
    expect(result).toBeNull();
  });
});
