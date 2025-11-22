"use client";

import { useAccount } from "wagmi";
import { useMockContract } from "@/hooks/use-mock-contract";
import { useEffect, useState } from "react";

interface LeaderboardEntry {
  address: string;
  score: number;
  rank: number;
}

interface LeaderboardProps {
  limit?: number;
}

export function Leaderboard({ limit = 10 }: LeaderboardProps) {
  const { address } = useAccount();
  const { fetchLeaderboard, fetchUserScore, loading } = useMockContract();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userScore, setUserScore] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        // TODO: Replace with real contract call
        const entries = await fetchLeaderboard(limit);
        const ranked = entries.map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));
        setLeaderboard(ranked);

        // Get user's score and rank
        if (address) {
          const score = await fetchUserScore(address);
          setUserScore(score);
          
          // Find user's rank
          const rank = ranked.findIndex((entry) => 
            entry.address.toLowerCase() === address.toLowerCase()
          );
          setUserRank(rank >= 0 ? rank + 1 : null);
        }
      } catch (error) {
        console.error("Failed to load leaderboard:", error);
      }
    };

    loadLeaderboard();
  }, [address, limit, fetchLeaderboard, fetchUserScore]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Leaderboard</h3>
        <p className="text-gray-600">Top players and their scores</p>
      </div>

      {/* User's Rank */}
      {address && (userScore !== null || userRank !== null) && (
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Your Rank</p>
              <p className="text-2xl font-bold text-gray-900">
                {userRank ? `#${userRank}` : "Not ranked"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Your Score</p>
              <p className="text-2xl font-bold text-gray-900">{userScore || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading leaderboard...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry) => {
            const isCurrentUser = address && 
              entry.address.toLowerCase() === address.toLowerCase();
            
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
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    entry.rank === 1
                      ? "bg-yellow-400 text-yellow-900"
                      : entry.rank === 2
                      ? "bg-gray-300 text-gray-700"
                      : entry.rank === 3
                      ? "bg-orange-300 text-orange-900"
                      : "bg-gray-200 text-gray-600"
                  }`}>
                    {entry.rank}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {isCurrentUser ? "You" : `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}
                    </p>
                    <p className="text-xs text-gray-500">{entry.address}</p>
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

      {/* TODO Marker */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          ⚠️ TODO: Connect to real contract to fetch actual leaderboard
        </p>
      </div>
    </div>
  );
}

