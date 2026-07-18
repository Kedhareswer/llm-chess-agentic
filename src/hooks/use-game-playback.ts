"use client";

import { useEffect, useRef, useState } from "react";
import { STARTING_FEN } from "@/lib/chess";
import { MOVE_PLAYBACK_MS } from "@/lib/config";
import type { Move } from "@/db/schema";

export interface GamePlayback {
  /** How many moves are currently shown on the board. */
  shownCount: number;
  /** FEN of the currently shown position. */
  displayedFen: string;
  /** True when the board has caught up to every move produced so far. */
  caughtUp: boolean;
}

/**
 * Paces a live game so moves appear one at a time.
 *
 * The server plays moves in bursts (many per tick), which would make the board
 * jump several moves per poll. This walks a "shown" cursor forward one move
 * every MOVE_PLAYBACK_MS toward the latest move, so react-chessboard animates
 * each move individually. When the board is already current it simply waits, so
 * a live game runs at the AI's own pace, not artificially fast.
 *
 * On a new game the cursor jumps straight to the current position (no replay of
 * history); only moves that arrive afterwards are animated.
 */
export function useGamePlayback(moves: Move[] | undefined, gameId: string | undefined): GamePlayback {
  const total = moves?.length ?? 0;
  const [shown, setShown] = useState(0);
  const seenGame = useRef<string | undefined>(undefined);

  // On a new game, jump to the current position instead of replaying from move
  // 1. Adjusting state during render (guarded by a ref) is React's recommended
  // pattern for "reset state when a prop changes" — no effect, no cascade.
  if (gameId && seenGame.current !== gameId) {
    seenGame.current = gameId;
    setShown(total);
  }

  // Advance one move at a time toward the latest.
  useEffect(() => {
    if (shown >= total) return;
    const t = setTimeout(() => setShown((n) => Math.min(n + 1, total)), MOVE_PLAYBACK_MS);
    return () => clearTimeout(t);
  }, [shown, total]);

  const clamped = Math.min(shown, total);
  const displayedFen = clamped === 0 || !moves ? STARTING_FEN : moves[clamped - 1].fenAfter;
  return { shownCount: clamped, displayedFen, caughtUp: clamped >= total };
}
