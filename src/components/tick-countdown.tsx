"use client";

import { useEffect, useState } from "react";

interface TournamentStatus {
  status: string;
  tickCount: number;
  tickIntervalSec: number;
  lastTickAt: string | null;
  nextTickAt: string | null;
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getSecondsUntilTick(nextTickAt: string | null): number {
  if (!nextTickAt) return 0;
  const now = Date.now();
  const next = new Date(nextTickAt).getTime();
  return Math.max(0, Math.floor((next - now) / 1000));
}

export function TickCountdown() {
  const [status, setStatus] = useState<TournamentStatus | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Fetch tournament status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/tournament/status");
        const data = await res.json();
        setStatus(data);
        setCountdown(getSecondsUntilTick(data.nextTickAt));
      } catch {
        // ignore
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!status || status.status !== "running") {
    return null;
  }

  const intervalSec = status.tickIntervalSec || 60;
  const progressPercent = Math.max(0, 100 - (countdown / intervalSec) * 100);

  return (
    <div className="border-b-2 border-black bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-xs font-bold uppercase text-gray-500">Next Tick</span>
        <div className="flex-1 h-2 bg-gray-200 border border-black max-w-xs">
          <div
            className="h-full bg-black transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="font-mono text-sm font-bold min-w-[3rem]">
          {formatCountdown(countdown)}
        </span>
        <span className="text-xs text-gray-500">
          Tick #{status.tickCount}
        </span>
      </div>
    </div>
  );
}
