"use client";

import { useEffect, useState } from "react";
import { GameCard } from "./game-card";
import type { Game, Model } from "@/db/schema";

type GameWithModels = Game & {
  whiteModel?: Model;
  blackModel?: Model;
};

export function GameGrid() {
  const [games, setGames] = useState<GameWithModels[]>([]);

  useEffect(() => {
    async function fetchGames() {
      const res = await fetch("/api/games?status=active");
      const data = await res.json();
      const first = data.games?.[0];
      if (!first) {
        setGames([]);
        return;
      }

      try {
        const detailRes = await fetch(`/api/games/${first.id}`);
        const detail = await detailRes.json();
        setGames([
          {
            ...first,
            whiteModel: detail.white,
            blackModel: detail.black,
          },
        ]);
      } catch {
        setGames([first]);
      }
    }

    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  if (games.length === 0) {
    return (
      <div className="flex h-full items-center justify-center border-2 border-black bg-white">
        <p className="text-gray-500">No active game. Select exactly two models and start a game.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 w-full max-w-[900px] mx-auto px-2 md:px-0" data-testid="game-grid">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
