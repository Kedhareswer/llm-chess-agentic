"use client";

import { useEffect, useState } from "react";
import { GameCard } from "./game-card";
import type { Game } from "@/db/schema";

export function GameGrid() {
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    async function fetchGames() {
      const res = await fetch("/api/games?status=active");
      const data = await res.json();
      setGames(data.games);
    }

    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  if (games.length === 0) {
    return (
      <div className="flex h-full items-center justify-center border-2 border-black bg-white">
        <p className="text-gray-500">No active games. Start the tournament!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
