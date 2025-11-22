"use client";

import { Card } from "@/types/card";

interface PredictionResult {
  card: Card;
  correct: boolean;
  actualValue?: number;
  points: number;
}

interface ResultsDisplayProps {
  results?: PredictionResult[];
  roundId?: number;
  totalPoints?: number;
}

export function ResultsDisplay({ results, roundId, totalPoints }: ResultsDisplayProps) {
  // TODO: Replace with real results from contract
  // For now, show mocked results
  const mockResults: PredictionResult[] = results || [
    {
      card: {
        id: "card-1234",
        cardNumber: 1234,
        asset: { id: "BTC", name: "Bitcoin", symbol: "BTC", pythPriceId: "0x...", type: "crypto" },
        predictionType: "price_up" as any,
      },
      correct: true,
      actualValue: 45000,
      points: 10,
    },
    {
      card: {
        id: "card-5678",
        cardNumber: 5678,
        asset: { id: "ETH", name: "Ethereum", symbol: "ETH", pythPriceId: "0x...", type: "crypto" },
        predictionType: "price_above" as any,
        targetValue: 0.05,
      },
      correct: false,
      actualValue: 0.02,
      points: 0,
    },
  ];

  const displayResults = results || mockResults;
  const displayRoundId = roundId || 1;
  const displayTotalPoints = totalPoints || displayResults.reduce((sum, r) => sum + r.points, 0);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Round {displayRoundId} Results</h3>
        <p className="text-gray-600">Your predictions and scores</p>
      </div>

      {/* Total Points */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-full">
          <span className="text-sm font-medium">Total Points:</span>
          <span className="text-2xl font-bold">{displayTotalPoints}</span>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {displayResults.map((result, index) => (
          <div
            key={result.card.id}
            className={`p-4 rounded-lg border-2 ${
              result.correct
                ? "bg-green-50 border-green-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-semibold text-gray-900">
                    {result.card.asset.symbol}
                  </span>
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
                  {result.actualValue !== undefined && (
                    <span className="ml-2">
                      • Actual: {result.actualValue}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {result.points > 0 ? "+" : ""}{result.points}
                </div>
                <div className="text-xs text-gray-500">points</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* TODO Marker */}
      {!results && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            ⚠️ TODO: Connect to real contract to fetch actual results
          </p>
        </div>
      )}
    </div>
  );
}

