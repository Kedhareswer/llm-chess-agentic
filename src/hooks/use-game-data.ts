"use client";

import { useCallback, useEffect, useState } from "react";
import type { Game, Move, Model } from "@/db/schema";

export interface GameData {
  game: Game;
  moves: Move[];
  white: Model;
  black: Model;
}

export interface UseGameDataResult {
  data: GameData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and auto-refresh game data
 * @param gameId - Game ID to fetch
 * @param refreshInterval - Auto-refresh interval in ms (default: 5000)
 */
export function useGameData(
  gameId: string | null,
  refreshInterval = 5000
): UseGameDataResult {
  const [data, setData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    
    try {
      setError(null);
      const res = await fetch(`/api/games/${gameId}`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch game: ${res.status}`);
      }
      
      const gameData = await res.json();
      setData(gameData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    fetchGame();
    const interval = setInterval(fetchGame, refreshInterval);
    return () => clearInterval(interval);
  }, [gameId, refreshInterval, fetchGame]);

  return { data, loading, error, refetch: fetchGame };
}