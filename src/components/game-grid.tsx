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
  const [previousGames, setPreviousGames] = useState<GameWithModels[]>([]);
  const [destroying, setDestroying] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [tickInfo, setTickInfo] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<string>("00:00");

  function formatElapsed(ms: number) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  async function fetchGames() {
    try {
      const res = await fetch("/api/games?status=active");
      if (!res.ok) return;
      const data = await res.json();
      const first = data.games?.[0];
      if (!first) {
        setGames([]);
        setElapsed("00:00");
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

      if (first.startedAt) {
        const started = new Date(first.startedAt).getTime();
        setElapsed(formatElapsed(Date.now() - started));
      }
    } catch (err) {
      // Silently handle network errors to prevent UI crashes
      console.error('Failed to fetch games:', err);
    }
  }

  async function fetchPreviousGames() {
    try {
      const res = await fetch("/api/games?status=complete");
      if (!res.ok) return;
      const data = await res.json();
      const gamesWithModels = await Promise.all(
        (data.games || []).slice(0, 8).map(async (game: Game) => {
          try {
            const detailRes = await fetch(`/api/games/${game.id}`);
            const detail = await detailRes.json();
            return {
              ...game,
              whiteModel: detail.white,
              blackModel: detail.black,
            };
          } catch {
            return game;
          }
        })
      );
      setPreviousGames(gamesWithModels);
    } catch (err) {
      // Silently handle network errors
      console.error('Failed to fetch previous games:', err);
    }
  }

  async function handleTickOnce() {
    setTickInfo(null);
    try {
      const res = await fetch("/api/cron/tick");
      if (!res.ok) {
        const text = await res.text();
        setTickInfo(`Tick failed: ${res.status} ${text}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setTickInfo(`Ticked (${data.gamesProcessed ?? "?"} games)`);
        await fetchGames();
      }
    } catch (e) {
      setTickInfo(`Tick error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  useEffect(() => {
    fetchGames();
    fetchPreviousGames();
    const interval = setInterval(() => {
      fetchGames();
      fetchPreviousGames();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Keep elapsed timer in sync with the current game's start time without recreating each second
  const startedAt = games[0]?.startedAt;
  useEffect(() => {
    if (!startedAt) {
      setElapsed("00:00");
      return;
    }
    const started = new Date(startedAt).getTime();
    setElapsed(formatElapsed(Date.now() - started));
    const timer = setInterval(() => {
      setElapsed(formatElapsed(Date.now() - started));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  // Drive game progression locally (disabled in production to avoid 401 spam)
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const tick = async () => {
      try {
        await fetch("/api/cron/tick");
      } catch {
        // ignore
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
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

  const hasActiveGame = games.length > 0;
  const hasPreviousGames = previousGames.length > 0;

  return (
    <div className="w-full max-w-[900px] mx-auto px-2 md:px-0 space-y-6" data-testid="game-grid">
      {hasActiveGame ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold">ACTIVE MATCH</h3>
              <p className="text-xs text-gray-600">10s per move · 2 consecutive timeouts → forfeit</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTickOnce}
                className="px-3 py-1 text-xs font-bold border-2 border-black bg-white hover:bg-gray-100"
                data-testid="tick-once"
              >
                Tick once
              </button>
              <button
                onClick={handleDestroy}
                disabled={destroying}
                className="px-3 py-1 text-xs font-bold border-2 border-black bg-white hover:bg-red-50 disabled:opacity-50"
              >
                {destroying ? "Destroying..." : "Destroy match"}
              </button>
            </div>
          </div>

          {tickInfo && (
            <div className="mb-2 p-2 text-xs border-2 border-black bg-blue-50" data-testid="tick-info">
              {tickInfo}
            </div>
          )}

          {info && (
            <div className="mb-2 p-2 text-xs border-2 border-black bg-yellow-50">
              {info}
            </div>
          )}

          <div className="space-y-4">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={{
                  ...game,
                  whiteName: game.whiteModel?.name,
                  blackName: game.blackModel?.name,
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center border-2 border-black bg-white">
          <p className="text-gray-500">No active game. Select exactly two models and start a game.</p>
        </div>
      )}

      {hasPreviousGames && (
        <div>
          <h3 className="text-sm font-bold mb-2">PREVIOUS GAMES</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[800px] overflow-y-auto border-2 border-black bg-gray-50 p-4">
            {previousGames.map((game) => (
              <div key={game.id} className="bg-white">
                <GameCard
                  game={{
                    ...game,
                    whiteName: game.whiteModel?.name,
                    blackName: game.blackModel?.name,
                  }}
                />
                {game.result && (
                  <div className="border-2 border-t-0 border-black p-2 bg-gray-50">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold">
                        {game.result === "1-0" ? "⚪ White wins" : game.result === "0-1" ? "⚫ Black wins" : "🤝 Draw"}
                      </span>
                      {game.resultReason && (
                        <p className="text-[10px] text-gray-600 leading-tight">{game.resultReason}</p>
                      )}
                      <span className="text-[10px] text-gray-500">
                        {game.endedAt && new Date(game.endedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
