import { test, expect } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { sanitizeId } from "../src/lib/utils";

test(
  "single game flow: select models -> start game -> shows one active game with stats",
  async ({ page }: { page: Page }) => {
  const modelA = {
    id: "groq/llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    provider: "groq",
    elo: 1520,
    gamesPlayed: 10,
    wins: 6,
    losses: 3,
    draws: 1,
    active: true,
  };

  const modelB = {
    id: "groq/compound",
    name: "Groq Compound",
    provider: "groq",
    elo: 1480,
    gamesPlayed: 10,
    wins: 4,
    losses: 4,
    draws: 2,
    active: true,
  };

  const gameId = "00000000-0000-0000-0000-000000000001";
  let started = false;

  await page.route("**/api/leaderboard", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ models: [modelA, modelB] }),
    });
  });

  await page.route("**/api/tournament/groq-key", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/games/start", async (route: Route) => {
    started = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        gameId,
        white: modelA.id,
        black: modelB.id,
      }),
    });
  });

  await page.route("**/api/cron/tick", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, gamesProcessed: started ? 1 : 0, tickCount: 1 }),
    });
  });

  await page.route("**/api/games?status=active", async (route: Route) => {
    const games = started
      ? [
          {
            id: gameId,
            whiteId: modelA.id,
            blackId: modelB.id,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            pgn: "",
            status: "active",
            result: null,
            startedAt: new Date().toISOString(),
            endedAt: null,
          },
        ]
      : [];

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ games }),
    });
  });

  await page.route(`**/api/games/${gameId}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        game: {
          id: gameId,
          whiteId: modelA.id,
          blackId: modelB.id,
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          pgn: "",
          status: "active",
          result: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
        moves: [],
        white: modelA,
        black: modelB,
      }),
    });
  });

  await page.goto("/");

  // No auto selection: start game button should be disabled initially
  await expect(page.getByTestId("start-game")).toBeDisabled();

  // Select two models via Game Setup list
  await page.getByTestId(`setup-select-model-${sanitizeId(modelA.id)}`).check();
  await page.getByTestId(`setup-select-model-${sanitizeId(modelB.id)}`).check();

  await expect(page.getByTestId("start-game")).toBeEnabled();

  // Start game
  await page.getByTestId("start-game").click();

  // Wait for game card + stats
  await expect(page.getByTestId("game-grid")).toBeVisible();
  await expect(page.getByTestId("game-card")).toHaveCount(1);

  await expect(page.getByTestId("black-stats")).toContainText("ELO");
  await expect(page.getByTestId("white-stats")).toContainText("ELO");
  }
);
