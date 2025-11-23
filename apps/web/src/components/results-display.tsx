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
  startPrice: number; // Price at game start (mocked)
  currentPrice: number; // Price at game end (mocked)
  priceDiff: number; // Price difference (mocked)
  priceDiffPercent: number; // Price difference as percentage (mocked)
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
        let correct = false;
        let points = 0;
        
        try {
          const response = await fetch(`/api/prediction-result?gameId=${gameId}&cardNumber=${cardNumber}`);
          if (response.ok) {
            const data = await response.json();
            correct = data.correct || false;
            points = Number(data.pointsEarned || 0);
          }
        } catch (error) {
          console.error(`Error fetching result for card ${cardNumber}:`, error);
        }

        // Generate mock price data (matching the actual card picked)
        // Use card number as seed for consistent mock data
        const seed = Number(cardNumber);
        const basePrice = 100 + (seed % 1000); // Base price between 100-1099
        const startPrice = basePrice;
        
        // Generate price change based on prediction type and whether it was correct
        let priceChangePercent = 0;
        if (card.predictionType === "price_up") {
          priceChangePercent = correct ? 5 + (seed % 10) : -(2 + (seed % 5)); // +5-15% if correct, -2-7% if wrong
        } else if (card.predictionType === "price_down") {
          priceChangePercent = correct ? -(5 + (seed % 10)) : (2 + (seed % 5)); // -5-15% if correct, +2-7% if wrong
        } else {
          priceChangePercent = correct ? 8 + (seed % 12) : -(3 + (seed % 6)); // Larger change for other types
        }
        
        const currentPrice = startPrice * (1 + priceChangePercent / 100);
        const priceDiff = currentPrice - startPrice;
        const priceDiffPercent = priceChangePercent;

        return {
          card,
          correct,
          points,
          startPrice,
          currentPrice,
          priceDiff,
          priceDiffPercent,
        };
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

  // Only show if game has ended
  // Note: We allow rendering even if playerChoice is temporarily undefined during polling
  // because we're using effectivePlayerChoice in useGameStateManager
  if (!gameId || gameState?.status !== GameStatus.ENDED) {
    console.log('🎮 [ResultsDisplay] Not rendering:', {
      gameId: gameId?.toString(),
      hasPlayerChoice: !!playerChoice,
      playerChoiceCommitted: playerChoice?.committed,
      gameStateStatus: gameState?.status,
    });
    return null;
  }
  
  // If playerChoice is not committed, still show results (they might have been committed but data is stale)
  if (!playerChoice?.committed) {
    console.log('🎮 [ResultsDisplay] Warning: playerChoice not committed, but showing results anyway:', {
      gameId: gameId.toString(),
      hasPlayerChoice: !!playerChoice,
    });
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
            className={`p-6 rounded-lg border-2 ${
              result.correct ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
            }`}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-gray-900">{result.card.asset.symbol}</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    result.correct
                      ? "bg-green-200 text-green-800"
                      : "bg-red-200 text-red-800"
                  }`}
                >
                  {result.correct ? "✓ Correct" : "✗ Incorrect"}
                </span>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">
                  {result.points > 0 ? "+" : ""}
                  {result.points}
                </div>
                <div className="text-xs text-gray-500">points earned</div>
              </div>
            </div>

            {/* Prediction Type */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Prediction:</p>
              <p className="text-base text-gray-900">
                {result.card.predictionType === "price_up" && `${result.card.asset.symbol} price will go UP`}
                {result.card.predictionType === "price_down" && `${result.card.asset.symbol} price will go DOWN`}
                {result.card.predictionType === "price_above" && `${result.card.asset.symbol} price will go ABOVE ${(result.card.targetValue! * 100).toFixed(0)}%`}
                {result.card.predictionType === "price_below" && `${result.card.asset.symbol} price will go BELOW ${(result.card.targetValue! * 100).toFixed(0)}%`}
                {result.card.predictionType === "market_cap_above" && `${result.card.asset.symbol} market cap will go ABOVE ${(result.card.targetValue! * 100).toFixed(0)}%`}
                {result.card.predictionType === "volume_above" && `${result.card.asset.symbol} volume will go ABOVE ${(result.card.targetValue! * 100).toFixed(0)}%`}
                {result.card.predictionType === "percentage_change" && `${result.card.asset.symbol} will ${result.card.direction === "up" ? "INCREASE" : "DECREASE"} by ${(result.card.percentageChange! * 100).toFixed(0)}%`}
              </p>
            </div>

            {/* Price Information */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs text-gray-500 mb-1">Start Price</p>
                <p className="text-lg font-semibold text-gray-900">${result.startPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Price</p>
                <p className="text-lg font-semibold text-gray-900">${result.currentPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Price Change</p>
                <p className={`text-lg font-semibold ${result.priceDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {result.priceDiff >= 0 ? "+" : ""}
                  {result.priceDiff.toFixed(2)} ({result.priceDiffPercent >= 0 ? "+" : ""}
                  {result.priceDiffPercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
