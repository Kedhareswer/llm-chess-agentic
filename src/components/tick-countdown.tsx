"use client";

import { useEffect, useState } from "react";

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TickCountdown() {
  const [elapsed, setElapsed] = useState("0:00");
  const [tickCount, setTickCount] = useState(0);
  const [gameStartedAt, setGameStartedAt] = useState<string | null>(null);

  // Fetch active game
  useEffect(() => {
    async function fetchGame() {
      try {
        const res = await fetch("/api/games?status=active");
        const data = await res.json();
        const game = data.games?.[0];
        if (game?.startedAt) {
          setGameStartedAt(game.startedAt);
        } else {
          setGameStartedAt(null);
          setElapsed("0:00");
        }
      } catch {
        // ignore
      }
    }

    fetchGame();
    const interval = setInterval(fetchGame, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch tick count
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/tournament/status");
        const data = await res.json();
        setTickCount(data.tickCount || 0);
      } catch {
        // ignore
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update elapsed timer
  useEffect(() => {
    if (!gameStartedAt) {
      setElapsed("0:00");
      return;
    }
    const started = new Date(gameStartedAt).getTime();
    setElapsed(formatElapsed(Date.now() - started));
    const timer = setInterval(() => {
      setElapsed(formatElapsed(Date.now() - started));
    }, 1000);
    return () => clearInterval(timer);
  }, [gameStartedAt]);

  if (!gameStartedAt) {
    return null;
  }

  return (
    <div className="border-b-2 border-black bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-xs font-bold uppercase text-gray-500">Elapsed</span>
        <span className="font-mono text-sm font-bold min-w-[3rem]">
          {elapsed}
        </span>
        <span className="text-xs text-gray-500">
          Tick #{tickCount}
        </span>
      </div>
    </div>
  );
}
