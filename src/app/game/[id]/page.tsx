"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { ReasoningPanel } from "@/components/reasoning-panel";
import { EvalBar } from "@/components/eval-bar";
import type { Game, Move, Model } from "@/db/schema";
import { formatElapsed } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useGameData } from "@/hooks/use-game-data";
import { POLLING_INTERVALS } from "@/lib/config";

interface GameData {
  game: Game;
  moves: Move[];
  white: Model;
  black: Model;
}

export default function GamePage() {
  const params = useParams();
  const [tickInfo, setTickInfo] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState("00:00");
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
  const [viewPosition, setViewPosition] = useState<string | null>(null);

  const gameId = params.id as string;
  
  const { data, loading, error, refetch } = useGameData(gameId, POLLING_INTERVALS.GAME_REFRESH_MS);
  
  useEffect(() => {
    if (data?.game?.startedAt) {
      const started = new Date(data.game.startedAt).getTime();
      
      // If game is complete, use endedAt; otherwise use current time
      const endedAt = data.game.endedAt;
      const isComplete = data.game.status === "complete" && endedAt !== null;
      const endTime = isComplete && endedAt ? new Date(endedAt).getTime() : Date.now();
      
      setElapsed(formatElapsed(endTime - started));
      
      // Only update timer if game is still active
      if (!isComplete) {
        const timer = setInterval(() => {
          setElapsed(formatElapsed(Date.now() - started));
        }, 1000);
        
        return () => clearInterval(timer);
      }
    }
  }, [data?.game?.startedAt, data?.game?.status, data?.game?.endedAt]);

  const handleTickOnce = useDebouncedCallback(async () => {
    setTickInfo(null);
    try {
      const res = await fetch("/api/cron/tick");
      if (!res.ok) {
        const text = await res.text();
        setTickInfo(`Tick failed: ${res.status} ${text}`);
        return;
      }
      setTickInfo("Ticked");
      await refetch();
    } catch (e) {
      setTickInfo(`Tick error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, 1000); // 1 second debounce

  if (loading || !data || !data.white || !data.black) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="text-red-500">Error loading game: {error.message}</span>
          <button 
            className="mt-2 px-4 py-2 border border-black"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isWhiteTurn = data.game.fen.split(" ")[1] === "w";
  const isActive = data.game.status === "active";

  // Get the selected move and its position
  const selectedMove = selectedMoveId ? data.moves.find(m => m.id === selectedMoveId) : null;
  const boardPosition = viewPosition || data.game.fen;

  const handleMoveClick = (moveId: string) => {
    setSelectedMoveId(moveId);
  };

  const handleViewSnapshot = (fen: string) => {
    setViewPosition(fen);
  };

  const handleBackToCurrent = () => {
    setViewPosition(null);
    setSelectedMoveId(null);
  };

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

      {/* Match finished banner */}
      {!isActive && data.game.result && (
        <div className="mb-4 p-4 border-4 border-black bg-gradient-to-r from-yellow-100 to-orange-100">
          <div className="text-center">
            <div className="text-2xl font-bold mb-2">
              🏆 MATCH FINISHED 🏆
            </div>
            <div className="text-lg font-semibold mb-2">
              {data.game.result === "1-0" && (
                <span className="text-green-700">
                  {data.white.name} WINS!
                </span>
              )}
              {data.game.result === "0-1" && (
                <span className="text-red-700">
                  {data.black.name} WINS!
                </span>
              )}
              {data.game.result === "1/2-1/2" && (
                <span className="text-gray-700">
                  DRAW
                </span>
              )}
            </div>
            <div className="text-sm text-gray-700 mb-1">
              Result: {data.game.result}
            </div>
            {data.game.resultReason && (
              <div className="text-sm font-medium text-gray-800 mt-2 p-2 bg-white border-2 border-gray-300 rounded">
                <span className="font-bold">Reason:</span> {data.game.resultReason}
              </div>
            )}
            {data.game.endedAt && (
              <div className="text-xs text-gray-500 mt-2">
                Finished: {new Date(data.game.endedAt).toLocaleString()}
              </div>
            )}
          </div>
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
          <ReasoningPanel 
            model={data.white} 
            moves={data.moves} 
            color="white" 
            isThinking={isActive && isWhiteTurn}
            selectedMoveId={selectedMoveId}
            onMoveClick={handleMoveClick}
            onViewSnapshot={handleViewSnapshot}
          />
        </div>

        {/* Board - 6 cols */}
        <div className="col-span-6 flex flex-col items-center gap-2">
          {viewPosition && viewPosition !== data.game.fen && (
            <button
              onClick={handleBackToCurrent}
              className="px-3 py-1 text-xs font-bold border-2 border-black bg-white hover:bg-gray-100"
            >
              ← Back to Current
            </button>
          )}
          <div className="flex items-center justify-center gap-2">
            <div className="h-[calc(100vh-200px)]">
              <EvalBar fen={boardPosition} />
            </div>
            <div className="w-full max-w-[calc(100vh-200px)] aspect-square">
              <Chessboard
                key={boardPosition}
                options={{
                  id: data.game.id,
                  position: boardPosition,
                  allowDragging: false,
                }}
              />
            </div>
          </div>
        </div>

        {/* Right panel - 3 cols */}
        <div
          className={`col-span-3 border-2 h-[calc(100vh-180px)] overflow-y-auto ${
            isActive && !isWhiteTurn ? "border-yellow-400 bg-yellow-50" : "border-black"
          }`}
        >
          <ReasoningPanel 
            model={data.black} 
            moves={data.moves} 
            color="black" 
            isThinking={isActive && !isWhiteTurn}
            selectedMoveId={selectedMoveId}
            onMoveClick={handleMoveClick}
            onViewSnapshot={handleViewSnapshot}
          />
        </div>
      </div>
    </div>
  );
}