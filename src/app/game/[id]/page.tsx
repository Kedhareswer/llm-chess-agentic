"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const gameId = params.id as string;
    if (!gameId) return;

    async function fetchGame() {
      const res = await fetch(`/api/games/${gameId}`);
      const gameData = await res.json();
      setData(gameData);
    }

    fetchGame();
    const interval = setInterval(fetchGame, 5000);
    return () => clearInterval(interval);
  }, [params.id]);

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
      <div className="mb-4 text-center">
        <h1 className="font-bold text-xl">
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
