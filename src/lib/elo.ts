const K = 32;

type GameOutcome = "win" | "loss" | "draw";

interface EloResult {
  newRating: number;
  change: number;
}

export function calculateNewElo(
  playerRating: number,
  opponentRating: number,
  outcome: GameOutcome
): EloResult {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

  const actual = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;

  const change = Math.round(K * (actual - expected));
  const newRating = playerRating + change;

  return { newRating, change };
}

export function outcomeFromResult(
  result: "1-0" | "0-1" | "1/2-1/2",
  isWhite: boolean
): GameOutcome {
  if (result === "1/2-1/2") return "draw";
  if (result === "1-0") return isWhite ? "win" : "loss";
  return isWhite ? "loss" : "win";
}
