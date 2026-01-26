"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GameCard } from "@/components/game-card";
import type { Game, Model } from "@/db/schema";
import { POLLING_INTERVALS } from "@/lib/config";

type GameWithModels = Game & {
  whiteModel?: Model;
  blackModel?: Model;
};

export default function GamesPage() {
  const [games, setGames] = useState<GameWithModels[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/games/bulk?status=complete&limit=50");
      if (!res.ok) {
        throw new Error(`Failed to fetch games: ${res.status}`);
      }
      const data = await res.json();
      setGames(data.games || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load games");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, POLLING_INTERVALS.GAME_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchGames]);

  return (
    <div className="min-h-full bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Game History</h1>
            <p className="text-sm text-gray-600 mt-1">
              Browse all completed games
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            New Game
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading games...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="border-2 border-red-500 bg-red-50 p-4 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <p className="text-red-700">{error}</p>
              <button
                onClick={fetchGames}
                className="px-3 py-1 text-xs font-bold border-2 border-red-700 bg-white hover:bg-red-100 rounded"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && games.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg bg-white">
            <p className="text-gray-500 mb-4">No completed games yet</p>
            <Link
              href="/"
              className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Start a Game
            </Link>
          </div>
        )}

        {/* Games grid */}
        {!loading && !error && games.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => (
              <div key={game.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <GameCard
                  game={{
                    ...game,
                    whiteName: game.whiteModel?.name,
                    blackName: game.blackModel?.name,
                  }}
                />
                {game.result && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      {game.result === "1-0" && (
                        <span className="text-sm font-bold text-green-700">
                          {game.whiteModel?.name || "White"} wins
                        </span>
                      )}
                      {game.result === "0-1" && (
                        <span className="text-sm font-bold text-red-700">
                          {game.blackModel?.name || "Black"} wins
                        </span>
                      )}
                      {game.result === "1/2-1/2" && (
                        <span className="text-sm font-bold text-gray-700">Draw</span>
                      )}
                      <span className="text-xs font-mono font-semibold text-gray-600 bg-white px-2 py-1 border border-gray-300 rounded">
                        {game.result}
                      </span>
                    </div>
                    {game.resultReason && (
                      <p className="text-xs text-gray-600 mb-2">{game.resultReason}</p>
                    )}
                    {game.endedAt && (
                      <p className="text-xs text-gray-400">
                        {new Date(game.endedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
