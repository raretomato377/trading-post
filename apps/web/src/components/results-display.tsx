"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card } from "@/types/card";
import { parseCards } from "@/lib/card-parser";
import { useGameStateManager } from "@/hooks/use-game-state";
import { usePlayerScore, GameStatus } from "@/hooks/use-trading-game";
import { useRouter } from "next/navigation";

interface PredictionResult {
  card: Card;
  correct: boolean;
  points: number;
}

interface ResultsDisplayProps {
  gameId: bigint | undefined;
  onBack?: () => void;
}

export function ResultsDisplay({ gameId, onBack }: ResultsDisplayProps) {
  const { address } = useAccount();
  const router = useRouter();
  // Don't poll when showing results - fetch once
  const { playerChoice, cards: contractCards, gameState } = useGameStateManager(gameId, true);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get player's lifetime score - refetch after game ends to get updated scores
  const { score: playerScore, refetch: refetchScore } = usePlayerScore(address);
  
  // Refetch score when results are loaded (in case endGame just completed)
  useEffect(() => {
    if (!isLoading && results.length > 0) {
      // Refetch score to get latest updates after endGame
      refetchScore();
    }
  }, [isLoading, results.length, refetchScore]);

  // Parse cards from contract
  const parsedCards = contractCards ? parseCards(contractCards.map((c) => Number(c))) : [];

  // Fetch results for each selected card using the contract
  useEffect(() => {
    const fetchResults = async () => {
      if (!gameId || !playerChoice?.committed || !playerChoice.selectedCards || !address) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      // Fetch results for each selected card
      const resultPromises = playerChoice.selectedCards.map(async (cardNumber) => {
        // Find the card object
        const card = parsedCards.find((c) => c.cardNumber === Number(cardNumber));
        if (!card) return null;

        // Fetch prediction result from contract
        try {
          const response = await fetch(`/api/prediction-result?gameId=${gameId}&cardNumber=${cardNumber}`);
          if (!response.ok) {
            console.error(`Failed to fetch result for card ${cardNumber}`);
            return {
              card,
              correct: false,
              points: 0,
            };
          }
          
          const data = await response.json();
          return {
            card,
            correct: data.correct || false,
            points: Number(data.pointsEarned || 0),
          };
        } catch (error) {
          console.error(`Error fetching result for card ${cardNumber}:`, error);
          return {
            card,
            correct: false,
            points: 0,
          };
        }
      });

      const fetchedResults = (await Promise.all(resultPromises)).filter((r) => r !== null) as PredictionResult[];
      
      setResults(fetchedResults);
      const gameTotalPoints = fetchedResults.reduce((sum, r) => sum + r.points, 0);
      setTotalPoints(gameTotalPoints);
      setIsLoading(false);
    };

    fetchResults();
  }, [gameId, playerChoice, parsedCards, address]);
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // Default: refresh the page to clear active game state
      router.refresh();
    }
  };

  // Only show if game has ended and player has committed choices
  if (!gameId || !playerChoice?.committed || gameState?.status !== GameStatus.ENDED) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading results...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
        <div className="text-center py-8">
          <p className="text-gray-600">No results available yet.</p>
          <p className="text-sm text-gray-500 mt-2">Results will appear after the game ends.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Game Results</h3>
        <p className="text-gray-600">Your predictions and scores</p>
        <p className="text-sm text-gray-500 mt-1">Game ID: {gameId?.toString()}</p>
      </div>

      {/* Back to Home Button */}
      <div className="mb-6 text-center">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors duration-200"
        >
          ← Back to Home
        </button>
      </div>

      {/* Total Points for this game */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-full">
          <span className="text-sm font-medium">Points This Game:</span>
          <span className="text-2xl font-bold">{totalPoints}</span>
        </div>
      </div>

      {/* Lifetime Stats */}
      {playerScore && (
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-4 bg-gray-50 border border-gray-200 px-6 py-3 rounded-lg">
            <div>
              <span className="text-xs text-gray-600 block">Total Lifetime Points</span>
              <span className="text-lg font-bold text-gray-900">{Number(playerScore.totalPoints)}</span>
            </div>
            <div className="h-8 w-px bg-gray-300"></div>
            <div>
              <span className="text-xs text-gray-600 block">Games Played</span>
              <span className="text-lg font-bold text-gray-900">{Number(playerScore.gamesPlayed)}</span>
            </div>
            <div className="h-8 w-px bg-gray-300"></div>
            <div>
              <span className="text-xs text-gray-600 block">Games Won</span>
              <span className="text-lg font-bold text-gray-900">{Number(playerScore.gamesWon)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-4">
        {results.map((result) => (
          <div
            key={result.card.id}
            className={`p-4 rounded-lg border-2 ${
              result.correct ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-semibold text-gray-900">{result.card.asset.symbol}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      result.correct
                        ? "bg-green-200 text-green-800"
                        : "bg-red-200 text-red-800"
                    }`}
                  >
                    {result.correct ? "✓ Correct" : "✗ Incorrect"}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Prediction: {result.card.predictionType}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {result.points > 0 ? "+" : ""}
                  {result.points}
                </div>
                <div className="text-xs text-gray-500">points</div>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
