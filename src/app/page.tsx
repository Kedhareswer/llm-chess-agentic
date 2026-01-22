import { Leaderboard } from "@/components/leaderboard";
import { GameGrid } from "@/components/game-grid";

export default function Home() {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-4">
        <GameGrid />
      </div>

      <div className="w-80 border-l-2 border-black p-4">
        <Leaderboard />
      </div>
    </div>
  );
}
