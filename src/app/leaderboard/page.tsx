import { db } from "@/db";
import { models } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const leaderboard = await db
    .select()
    .from(models)
    .orderBy(desc(models.elo));

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">LEADERBOARD</h1>

      <div className="border-2 border-black bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-black bg-gray-50 text-left text-sm">
              <th className="px-4 py-3 font-bold">RANK</th>
              <th className="px-4 py-3 font-bold">MODEL</th>
              <th className="px-4 py-3 font-bold">PROVIDER</th>
              <th className="px-4 py-3 text-right font-bold">ELO</th>
              <th className="px-4 py-3 text-right font-bold">GAMES</th>
              <th className="px-4 py-3 text-right font-bold">W</th>
              <th className="px-4 py-3 text-right font-bold">L</th>
              <th className="px-4 py-3 text-right font-bold">D</th>
              <th className="px-4 py-3 text-right font-bold">WIN %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaderboard.map((model, index) => {
              const totalGames = model.wins + model.losses + model.draws;
              const winRate = totalGames > 0 ? (model.wins / totalGames) * 100 : 0;

              return (
                <tr key={model.id} className="text-sm hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 font-medium">{model.name}</td>
                  <td className="px-4 py-3 text-gray-600">{model.provider}</td>
                  <td className="px-4 py-3 text-right font-bold">{model.elo}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {model.gamesPlayed}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {model.wins}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {model.losses}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {model.draws}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {winRate.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
