"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { GameCard } from "./game-card";
import type { Game, Model } from "@/db/schema";
import { formatElapsed } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { POLLING_INTERVALS } from "@/lib/config";

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
  const [isNewGame, setIsNewGame] = useState(false);
  const [recentlyEndedGame, setRecentlyEndedGame] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState("00:00");
  const previousGameIdRef = useRef<string | null>(null);
  
  // Error states for game fetching
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [previousGamesError, setPreviousGamesError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      setGamesError(null); // Clear previous errors
      const res = await fetch("/api/games?status=active");
      if (!res.ok) {
        throw new Error(`Failed to fetch games: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      const first = data.games?.[0];
      if (!first) {
        // Check if we had an active game before - it just ended
        if (previousGameIdRef.current) {
          setRecentlyEndedGame(previousGameIdRef.current);
          previousGameIdRef.current = null;
          // Clear the ended game highlight after animation
          setTimeout(() => setRecentlyEndedGame(null), 3000);
        }
        setGames([]);
        return;
      }

      // Detect new game start
      if (first.id !== previousGameIdRef.current) {
        if (previousGameIdRef.current !== null) {
          // Previous game ended, new one started
          setRecentlyEndedGame(previousGameIdRef.current);
          setTimeout(() => setRecentlyEndedGame(null), 3000);
        }
        previousGameIdRef.current = first.id;
        setIsNewGame(true);
        // Clear new game animation after it plays
        setTimeout(() => setIsNewGame(false), 2500);
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch games';
      console.error('Failed to fetch games:', err);
      setGamesError(errorMessage);
    }
  }, []);

  const fetchPreviousGames = useCallback(async () => {
    try {
      setPreviousGamesError(null); // Clear previous errors
      const res = await fetch("/api/games/bulk?status=complete&limit=8");
      if (!res.ok) {
        throw new Error(`Failed to fetch previous games: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setPreviousGames(data.games);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch previous games';
      console.error('Failed to fetch previous games:', err);
      setPreviousGamesError(errorMessage);
    }
  }, []);

  const handleTickOnce = useDebouncedCallback(async () => {
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
  }, 1000); // 1 second debounce

  useEffect(() => {
    fetchGames();
    fetchPreviousGames();
    const interval = setInterval(() => {
      fetchGames();
      fetchPreviousGames();
    }, POLLING_INTERVALS.GAME_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  // Automatic tick heartbeat - every 3s check for active games and tick once
  useEffect(() => {
    const tickInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/games?status=active");
        if (!res.ok) return;
        const data = await res.json();
        if ((data.games || []).length === 0) return;
        await fetch("/api/cron/tick");
      } catch {
        // Silently ignore tick errors
      }
    }, 3000);

    return () => clearInterval(tickInterval);
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
      {/* Error message for active games */}
      {gamesError && (
        <div className="border-2 border-red-500 bg-red-50 p-4" data-testid="games-error">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-bold text-red-900 mb-1">Failed to load active games</h4>
              <p className="text-sm text-red-700">{gamesError}</p>
            </div>
            <button
              onClick={() => {
                setGamesError(null);
                fetchGames();
              }}
              className="px-3 py-1 text-xs font-bold border-2 border-red-900 bg-white hover:bg-red-100"
              data-testid="retry-games"
            >
              Retry
            </button>
          </div>
        </div>
      )}

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
              <div
                key={game.id}
                className={isNewGame ? "animate-game-start" : ""}
              >
                <GameCard
                  game={{
                    ...game,
                    whiteName: game.whiteModel?.name,
                    blackName: game.blackModel?.name,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : !gamesError ? (
        <div className="flex h-64 items-center justify-center border-2 border-black bg-white">
          <p className="text-gray-500">No active game. Select exactly two models and start a game.</p>
        </div>
      ) : null}

      {(hasPreviousGames || previousGamesError) && (
        <div>
          <h3 className="text-sm font-bold mb-2">PREVIOUS GAMES</h3>
          
          {/* Error message for previous games */}
          {previousGamesError && (
            <div className="border-2 border-red-500 bg-red-50 p-4 mb-4" data-testid="previous-games-error">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-red-900 mb-1">Failed to load previous games</h4>
                  <p className="text-sm text-red-700">{previousGamesError}</p>
                </div>
                <button
                  onClick={() => {
                    setPreviousGamesError(null);
                    fetchPreviousGames();
                  }}
                  className="px-3 py-1 text-xs font-bold border-2 border-red-900 bg-white hover:bg-red-100"
                  data-testid="retry-previous-games"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          
          {hasPreviousGames && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[800px] overflow-y-auto border-2 border-black bg-gray-50 p-4">
            {previousGames.map((game) => {
              const isRecentlyEnded = game.id === recentlyEndedGame;
              const victoryClass = isRecentlyEnded
                ? game.result === "1-0"
                  ? "animate-victory-white"
                  : game.result === "0-1"
                  ? "animate-victory-black"
                  : "animate-draw"
                : "";
              
              return (
                <div
                  key={game.id}
                  className={`bg-white transition-all duration-300 ${victoryClass}`}
                >
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
                        {game.result === "1-0" && (
                          <span className={`text-xs font-bold text-green-700 flex items-center gap-1 ${isRecentlyEnded ? "animate-victory-white" : ""}`}>
                            <span className="inline-block">🏆</span> White wins
                          </span>
                        )}
                        {game.result === "0-1" && (
                          <span className={`text-xs font-bold text-red-700 flex items-center gap-1 ${isRecentlyEnded ? "animate-victory-black" : ""}`}>
                            <span className="inline-block">🏆</span> Black wins
                          </span>
                        )}
                        {game.result === "1/2-1/2" && (
                          <span className={`text-xs font-bold text-gray-700 flex items-center gap-1 ${isRecentlyEnded ? "animate-draw" : ""}`}>
                            <span className="inline-block">🤝</span> Draw
                          </span>
                        )}
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
              );
            })}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
