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
  const [destroying, setDestroying] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

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

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleDestroy() {
    setDestroying(true);
    setInfo(null);
    try {
      const res = await fetch("/api/games/destroy", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setInfo(data.deleted ? "Match destroyed" : "No active match");
      await fetchGames();
    } catch {
      setInfo("Failed to destroy match");
    } finally {
      setDestroying(false);
    }
  }

  if (games.length === 0) {
    return (
      <div className="flex h-full items-center justify-center border-2 border-black bg-white">
        <p className="text-gray-500">No active game. Select exactly two models and start a game.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[900px] mx-auto px-2 md:px-0" data-testid="game-grid">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold">ACTIVE MATCH</h3>
        <div className="flex items-center gap-2">
          {info && <span className="text-[11px] text-gray-600">{info}</span>}
          <button
            onClick={handleDestroy}
            disabled={destroying || games.length === 0}
            className="border-2 border-black bg-white text-xs px-2 py-1 disabled:opacity-50"
            data-testid="destroy-match"
          >
            {destroying ? "Destroying..." : "Destroy match"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
