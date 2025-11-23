"use client";

import { useAccount } from "wagmi";
import { usePlayerScore } from "@/hooks/use-trading-game";
import { useEffect, useState } from "react";

interface LeaderboardEntry {
  address: string;
  score: number;
  gamesPlayed: number;
  gamesWon: number;
  rank: number;
}

interface LeaderboardProps {
  limit?: number;
}

export function Leaderboard({ limit = 10 }: LeaderboardProps) {
  const { address } = useAccount();
  const { score: userScore, isLoading: isLoadingUserScore } = usePlayerScore(address);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Contract doesn't have a function to get full leaderboard
    // We would need to either:
    // 1. Add a leaderboard function to the contract that maintains a sorted list
    // 2. Track leaderboard off-chain (database, indexer, etc.)
    // 3. Use events to build leaderboard client-side
    
    // For now, show user's score if available
    if (userScore) {
      setLeaderboard([
        {
          address: address || "0x0000000000000000000000000000000000000000",
          score: Number(userScore.totalPoints),
          gamesPlayed: Number(userScore.gamesPlayed),
          gamesWon: Number(userScore.gamesWon),
          rank: 1, // Placeholder
        },
      ]);
    }
    setIsLoading(false);
  }, [userScore, address]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Leaderboard</h3>
        <p className="text-gray-600">Top players and their scores</p>
      </div>

      {/* User's Score */}
      {address && userScore && (
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-gray-600">Your Total Points</p>
              <p className="text-2xl font-bold text-gray-900">{Number(userScore.totalPoints)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Games Played</p>
              <p className="text-2xl font-bold text-gray-900">{Number(userScore.gamesPlayed)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Games Won</p>
              <p className="text-2xl font-bold text-gray-900">{Number(userScore.gamesWon)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      {isLoading || isLoadingUserScore ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading leaderboard...</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No leaderboard data available.</p>
          <p className="text-sm text-gray-500 mt-2">
            Play a game to see your score on the leaderboard!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry) => {
            const isCurrentUser =
              address && entry.address.toLowerCase() === address.toLowerCase();

            return (
              <div
                key={entry.address}
                className={`p-4 rounded-lg border-2 flex items-center justify-between ${
                  isCurrentUser
                    ? "bg-blue-50 border-blue-300"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      entry.rank === 1
                        ? "bg-yellow-400 text-yellow-900"
                        : entry.rank === 2
                        ? "bg-gray-300 text-gray-700"
                        : entry.rank === 3
                        ? "bg-orange-300 text-orange-900"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {entry.rank}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {isCurrentUser
                        ? "You"
                        : `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {entry.gamesPlayed} games • {entry.gamesWon} wins
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900">{entry.score}</p>
                  <p className="text-xs text-gray-500">points</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
