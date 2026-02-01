"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { Game, Move, Model } from "@/db/schema";
import { usePageVisibility } from "@/hooks/use-page-visibility";
import { POLLING_INTERVALS } from "@/lib/config";

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
 * Hook to fetch and auto-refresh game data.
 * Uses slower polling when tab is hidden or when game is complete (Vercel-friendly).
 */
export function useGameData(gameId: string | null): UseGameDataResult {
  const [data, setData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const previousMoveCountRef = useRef<number>(0);
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visible = usePageVisibility();

  const fetchGame = useCallback(async () => {
    if (!gameId) return;

    try {
      setError(null);
      const res = await fetch(`/api/games/${gameId}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch game: ${res.status}`);
      }

      const gameData = await res.json();
      const currentMoveCount = gameData.moves?.length || 0;
      const previousMoveCount = previousMoveCountRef.current;
      
      setData((prevData) => {
        const wasActive = prevData?.game?.status === "active";
        const isActive = gameData.game?.status === "active";
        
        // If move count increased and game is active, schedule immediate refetch to catch rapid moves
        if (currentMoveCount > previousMoveCount && wasActive && isActive) {
          // Clear any pending timeout
          if (refetchTimeoutRef.current) {
            clearTimeout(refetchTimeoutRef.current);
          }
          // Schedule immediate refetch after a short delay to catch the next move
          refetchTimeoutRef.current = setTimeout(() => {
            // Use a fresh fetch to avoid stale closure
            fetch(`/api/games/${gameId}`)
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (data) {
                  setData(data);
                  previousMoveCountRef.current = data.moves?.length || 0;
                }
              })
              .catch(() => {});
          }, 300);
        }
        
        return gameData;
      });
      
      previousMoveCountRef.current = currentMoveCount;
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

    const ms = visible
      ? data?.game?.status === "complete"
        ? POLLING_INTERVALS.COMPLETED_GAME_REFRESH_MS
        : POLLING_INTERVALS.GAME_REFRESH_MS
      : POLLING_INTERVALS.WHEN_TAB_HIDDEN_MS;

    const interval = setInterval(fetchGame, ms);
    return () => {
      clearInterval(interval);
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
    };
  }, [gameId, visible, data?.game?.status, fetchGame]);

  return { data, loading, error, refetch: fetchGame };
}