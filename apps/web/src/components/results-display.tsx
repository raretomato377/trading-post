"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Card } from "@/types/card";
import { parseCards } from "@/lib/card-parser";
import { usePlayerChoices, usePredictionResult, useGameCards } from "@/hooks/use-trading-game";
import { useGameStateManager } from "@/hooks/use-game-state";

interface PredictionResult {
  card: Card;
  correct: boolean;
  points: number;
}

interface ResultsDisplayProps {
  gameId: bigint | undefined;
}

export function ResultsDisplay({ gameId }: ResultsDisplayProps) {
  const { address } = useAccount();
  const { playerChoice, cards: contractCards } = useGameStateManager(gameId);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Parse cards from contract
  const parsedCards = contractCards ? parseCards(contractCards.map((c) => Number(c))) : [];

  // Fetch results for each selected card
  useEffect(() => {
    const fetchResults = async () => {
      if (!gameId || !playerChoice?.committed || !playerChoice.selectedCards) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const resultPromises = playerChoice.selectedCards.map(async (cardNumber) => {
        // Find the card object
        const card = parsedCards.find((c) => c.cardNumber === Number(cardNumber));
        if (!card) return null;

        // Fetch prediction result from contract
        // Note: In a real implementation, we'd use usePredictionResult hook
        // For now, we'll need to call it for each card
        // This is a simplified version - in production you'd batch these calls
        return {
          card,
          cardNumber: Number(cardNumber),
        };
      });

      const cardData = (await Promise.all(resultPromises)).filter((d) => d !== null) as Array<{
        card: Card;
        cardNumber: number;
      }>;

      // TODO: Fetch actual results from contract using usePredictionResult
      // For now, show placeholder
      const mockResults: PredictionResult[] = cardData.map(({ card }) => ({
        card,
        correct: false, // TODO: Fetch from contract
        points: 0, // TODO: Fetch from contract
      }));

      setResults(mockResults);
      setTotalPoints(mockResults.reduce((sum, r) => sum + r.points, 0));
      setIsLoading(false);
    };

    fetchResults();
  }, [gameId, playerChoice, parsedCards]);

  // Only show if game has ended and player has committed choices
  if (!gameId || !playerChoice?.committed) {
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
      </div>

      {/* Total Points */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-full">
          <span className="text-sm font-medium">Total Points:</span>
          <span className="text-2xl font-bold">{totalPoints}</span>
        </div>
      </div>

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

      {/* TODO Marker */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          ⚠️ TODO: Results fetching needs to be fully implemented with contract integration
        </p>
      </div>
    </div>
  );
}
