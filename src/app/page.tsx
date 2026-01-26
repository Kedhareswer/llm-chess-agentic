"use client";

import { useState } from "react";
import clsx from "clsx";
import { Leaderboard } from "@/components/leaderboard";
import { GameGrid } from "@/components/game-grid";

export default function Home() {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div
        className="flex-1 overflow-auto p-4"
        onClick={() => {
          if (showSidebar) {
            setShowSidebar(false);
          }
        }}
      >
        <GameGrid />
      </div>

      <div className="border-t-2 border-black md:border-t-0 md:border-l-2 md:w-80 p-4 overflow-y-auto bg-white">
        {/* Mobile toggle for leaderboard */}
        <button
          type="button"
          className="mb-2 inline-flex items-center justify-between w-full border-2 border-black px-3 py-1 text-xs font-bold uppercase bg-gray-100 md:hidden"
          onClick={() => setShowSidebar((prev) => !prev)}
        >
          <span>Leaderboard</span>
          <span className="text-[10px]">{showSidebar ? "Hide" : "Show"}</span>
        </button>

        <div
          className={clsx(
            "mt-2 md:mt-0",
            // On mobile, hide when collapsed; on desktop, always show
            showSidebar ? "block" : "hidden md:block"
          )}
        >
          <Leaderboard />
        </div>
      </div>
    </div>
  );
}
