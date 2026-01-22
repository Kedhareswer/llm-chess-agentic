import { describe, it, expect } from "vitest";
import { calculateNewElo } from "./elo";

describe("ELO calculation", () => {
  it("winner gains, loser loses points", () => {
    const result = calculateNewElo(1500, 1500, "win");
    expect(result.newRating).toBeGreaterThan(1500);
    expect(result.change).toBe(16); // K=32, expected=0.5, (1-0.5)*32=16
  });

  it("weaker player gains more for upset", () => {
    const upset = calculateNewElo(1400, 1600, "win");
    const expected = calculateNewElo(1600, 1400, "win");
    expect(upset.change).toBeGreaterThan(expected.change);
  });

  it("draw against equal opponent is neutral", () => {
    const result = calculateNewElo(1500, 1500, "draw");
    expect(result.change).toBe(0);
  });

  it("loss decreases rating", () => {
    const result = calculateNewElo(1500, 1500, "loss");
    expect(result.newRating).toBeLessThan(1500);
    expect(result.change).toBe(-16);
  });
});
