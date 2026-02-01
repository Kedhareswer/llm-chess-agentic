"use client";

import Link from "next/link";
import { Chessboard } from "react-chessboard";
import { EvalBar } from "./eval-bar";
import type { Game, Model } from "@/db/schema";

interface GameCardProps {
  game: Game & {
    whiteName?: string;
    blackName?: string;
    whiteModel?: Model;
    blackModel?: Model;
  };
}

export function GameCard({ game }: GameCardProps) {
  const isWhiteTurn = game.fen.split(" ")[1] === "w";
  const isActive = game.status === "active";

  return (
    <Link
      href={`/game/${game.id}`}
      className="border border-gray-200 bg-white p-3 hover:shadow-md transition-all block w-full max-w-[780px] mx-auto rounded-lg"
      data-testid="game-card"
    >
      {/* Black player - top */}
      <div
        className={`text-xs flex justify-between px-1 mb-1 ${isActive && !isWhiteTurn ? "bg-yellow-100" : ""}`}
      >
        <div className="flex flex-col">
          <span className="font-medium">{game.blackName || game.blackId}</span>
          {game.blackModel && (
            <span className="text-[11px] text-gray-600" data-testid="black-stats">
              ELO {game.blackModel.elo} · W{game.blackModel.wins}/L{game.blackModel.losses}/D{game.blackModel.draws}
            </span>
          )}
        </div>
        <span className="text-gray-500">black</span>
      </div>

      {/* Board with eval bar */}
      <div className="flex gap-1 items-stretch">
        <div className="w-4 flex-shrink-0" style={{ aspectRatio: "1/8" }}>
          <EvalBar fen={game.fen} />
        </div>
        <div className="aspect-square flex-1 max-w-[90vw] md:max-w-[780px]">
          <Chessboard
            options={{
              position: game.fen,
              allowDragging: false,
              boardStyle: { borderRadius: "0" },
              animationDurationInMs: 300,
            }}
          />
        </div>
      </div>

      {/* White player - bottom */}
      <div
        className={`text-xs flex justify-between px-1 mt-1 ${isActive && isWhiteTurn ? "bg-yellow-100" : ""}`}
      >
        <div className="flex flex-col">
          <span className="font-medium">{game.whiteName || game.whiteId}</span>
          {game.whiteModel && (
            <span className="text-[11px] text-gray-600" data-testid="white-stats">
              ELO {game.whiteModel.elo} · W{game.whiteModel.wins}/L{game.whiteModel.losses}/D{game.whiteModel.draws}
            </span>
          )}
        </div>
        <span className="text-gray-500">white</span>
      </div>
    </Link>
  );
}
