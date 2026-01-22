"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { ReasoningPanel } from "@/components/reasoning-panel";
import { EvalBar } from "@/components/eval-bar";
import type { Game, Move, Model } from "@/db/schema";

interface GameData {
  game: Game;
  moves: Move[];
  white: Model;
  black: Model;
}

export default function GamePage() {
  const params = useParams();
  const [data, setData] = useState<GameData | null>(null);
  const [elapsed, setElapsed] = useState("00:00");
  const [tickInfo, setTickInfo] = useState<string | null>(null);

  function formatElapsed(ms: number) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  const gameId = params.id as string;

  const fetchGame = useCallback(async () => {
    if (!gameId) return;
    const res = await fetch(`/api/games/${gameId}`);
    const gameData = await res.json();
    setData(gameData);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    fetchGame();
    const interval = setInterval(fetchGame, 5000);
    const timer = setInterval(() => {
      setData((prev) => {
        if (!prev?.game?.startedAt) return prev;
        const started = new Date(prev.game.startedAt).getTime();
        setElapsed(formatElapsed(Date.now() - started));
        return prev;
      });
    }, 1000);
    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [gameId, fetchGame]);

  useEffect(() => {
    if (data?.game?.startedAt) {
      const started = new Date(data.game.startedAt).getTime();
      setElapsed(formatElapsed(Date.now() - started));
    }
  }, [data?.game?.startedAt]);

  async function handleTickOnce() {
    setTickInfo(null);
    try {
      const res = await fetch("/api/cron/tick");
      if (!res.ok) {
        const text = await res.text();
        setTickInfo(`Tick failed: ${res.status} ${text}`);
        return;
      }
      setTickInfo("Ticked");
      await fetchGame();
    } catch (e) {
      setTickInfo(`Tick error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!data || !data.white || !data.black) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  const isWhiteTurn = data.game.fen.split(" ")[1] === "w";
  const isActive = data.game.status === "active";

  return (
    <div className="p-4">
      {/* Title bar */}
      <div className="mb-4 flex flex-col items-center gap-2">
        <div className="flex w-full items-center justify-between">
          <div className="text-left">
            <div className="text-xs text-gray-600">Elapsed: {elapsed}</div>
            {data.game.result && (
              <div className="text-xs text-gray-500">Result: {data.game.result}</div>
            )}
          </div>
          {isActive && (
            <button
              onClick={handleTickOnce}
              className="px-3 py-1 text-xs font-bold border-2 border-black bg-white hover:bg-gray-100"
              data-testid="detail-tick-once"
            >
              Tick once
            </button>
          )}
        </div>
        <h1 className="font-bold text-xl text-center">
          <span className={isActive && isWhiteTurn ? "bg-yellow-200 px-2" : ""}>
            {data.white.name}
          </span>
          {" vs "}
          <span className={isActive && !isWhiteTurn ? "bg-yellow-200 px-2" : ""}>
            {data.black.name}
          </span>
          {data.game.result && (
            <span className="ml-4 text-sm font-normal text-gray-500">
              Result: {data.game.result}
            </span>
          )}
        </h1>
      </div>

      {tickInfo && (
        <div className="mb-4 p-2 text-xs border-2 border-black bg-blue-50 text-center" data-testid="detail-tick-info">
          {tickInfo}
        </div>
      )}

      {/* 12-column grid: 3 | 6 | 3 */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left panel - 3 cols */}
        <div
          className={`col-span-3 border-2 h-[calc(100vh-180px)] overflow-y-auto ${
            isActive && isWhiteTurn ? "border-yellow-400 bg-yellow-50" : "border-black"
          }`}
        >
          <ReasoningPanel model={data.white} moves={data.moves} color="white" isThinking={isActive && isWhiteTurn} />
        </div>

        {/* Board - 6 cols */}
        <div className="col-span-6 flex items-center justify-center gap-2">
          <div className="h-[calc(100vh-200px)]">
            <EvalBar fen={data.game.fen} />
          </div>
          <div className="w-full max-w-[calc(100vh-200px)] aspect-square">
            <Chessboard
              key={data.game.fen}
              options={{
                id: data.game.id,
                position: data.game.fen,
                allowDragging: false,
              }}
            />
          </div>
        </div>

        {/* Right panel - 3 cols */}
        <div
          className={`col-span-3 border-2 h-[calc(100vh-180px)] overflow-y-auto ${
            isActive && !isWhiteTurn ? "border-yellow-400 bg-yellow-50" : "border-black"
          }`}
        >
          <ReasoningPanel model={data.black} moves={data.moves} color="black" isThinking={isActive && !isWhiteTurn} />
        </div>
      </div>
    </div>
  );
}
