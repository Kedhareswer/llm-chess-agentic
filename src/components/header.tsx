"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLeaderboard } from "@/contexts/leaderboard-context";
import { useRouter } from "next/navigation";

interface HeaderProps {
  onMenuClick: () => void;
  onSettingsClick: () => void;
}

export function Header({ onMenuClick, onSettingsClick }: HeaderProps) {
  const { refetch, isRefetching } = useLeaderboard();
  const router = useRouter();
  const [hasActiveGame, setHasActiveGame] = useState(false);
  const [destroying, setDestroying] = useState(false);

  // Check for active game
  useEffect(() => {
    async function checkActiveGame() {
      try {
        const res = await fetch("/api/games?status=active");
        if (res.ok) {
          const data = await res.json();
          setHasActiveGame(data.games?.length > 0);
        }
      } catch {
        // Ignore errors
      }
    }
    checkActiveGame();
    // Poll every 5 seconds to update button state
    const interval = setInterval(checkActiveGame, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleDestroy() {
    if (!hasActiveGame || destroying) return;
    setDestroying(true);
    try {
      const res = await fetch("/api/games/destroy", { method: "POST" });
      const data = await res.json();
      if (data.aborted > 0 || data.success) {
        setHasActiveGame(false);
        // Refresh the page to update UI
        router.refresh();
        // Also refetch leaderboard
        refetch();
      }
    } catch (error) {
      console.error("Failed to destroy game:", error);
    } finally {
      setDestroying(false);
    }
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="LLM Chess Arena" width={32} height={32} />
          <span className="text-lg font-bold tracking-tight">LLM Chess Arena</span>
        </Link>

        <div className="flex items-center gap-2">
          {hasActiveGame && (
            <button
              onClick={handleDestroy}
              disabled={destroying}
              className="px-3 py-1.5 text-sm font-semibold text-red-700 border border-red-300 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Destroy active game"
              title="Destroy active game"
              data-testid="destroy-game-button"
            >
              {destroying ? "Destroying..." : "Destroy Game"}
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Refresh leaderboard and data"
            title="Refresh data"
          >
            <svg
              className={`w-6 h-6 text-gray-700 ${isRefetching ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            onClick={onSettingsClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open settings"
            title="API Key Settings"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
