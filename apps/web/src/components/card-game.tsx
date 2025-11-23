"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Card } from "@/types/card";
import { parseCards } from "@/lib/card-parser";
import { PredictionCard } from "./prediction-card";
import {
  useGameCards,
  useCommitChoices,
  usePlayerChoices,
  GameStatus,
} from "@/hooks/use-trading-game";
import { useGameStateManager, formatTimeRemaining } from "@/hooks/use-game-state";

interface CardGameProps {
  gameId: bigint | undefined;
  maxSelections?: number; // Default: 3
  onChoicesCommitted?: () => void;
}

export function CardGame({ gameId, maxSelections = 3, onChoicesCommitted }: CardGameProps) {
  const { address } = useAccount();
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [parsedCards, setParsedCards] = useState<Card[]>([]);

  const {
    gameState,
    cards: contractCards,
    playerChoice,
    choiceTimeRemaining,
    resolutionTimeRemaining,
    hasCommitted,
    isLoading,
  } = useGameStateManager(gameId);

  const { commitChoices, isPending: isCommitting, isSuccess: commitSuccess } = useCommitChoices(gameId);

  // Parse contract cards into Card objects when they're available
  useEffect(() => {
    if (contractCards && contractCards.length > 0) {
      const numbers = contractCards.map((c) => Number(c));
      const parsed = parseCards(numbers);
      setParsedCards(parsed);
    }
  }, [contractCards]);

  // Handle commit success
  useEffect(() => {
    if (commitSuccess && onChoicesCommitted) {
      onChoicesCommitted();
    }
  }, [commitSuccess, onChoicesCommitted]);

  // Show cards when game is in CHOICE state OR when player has committed (to show their selections in resolution)
  // After committing, visually transition to resolution phase even if game state is still CHOICE
  const canShowCards = gameState?.status === GameStatus.CHOICE || (hasCommitted && gameState?.status !== GameStatus.ENDED);
  const isInResolutionPhase = hasCommitted || gameState?.status === GameStatus.RESOLUTION;

  const handleCardClick = (card: Card) => {
    // Don't allow changes if already committed
    if (hasCommitted) return;

    const isSelected = selectedCards.some((c) => c.id === card.id);

    if (isSelected) {
      // Deselect
      setSelectedCards(selectedCards.filter((c) => c.id !== card.id));
    } else {
      // Select (if under limit)
      if (selectedCards.length < maxSelections) {
        setSelectedCards([...selectedCards, card]);
      }
    }
  };

  const handleCommitChoices = async () => {
    if (selectedCards.length !== maxSelections || !gameId) return;

    // Convert Card objects to card numbers (bigint array)
    const cardNumbers: [bigint, bigint, bigint] = [
      BigInt(selectedCards[0].cardNumber),
      BigInt(selectedCards[1].cardNumber),
      BigInt(selectedCards[2].cardNumber),
    ];

    commitChoices(cardNumbers);
  };

  // Show loading state
  if (isLoading && !gameState) {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  // Show message if game is not in a state where cards can be shown
  if (!canShowCards && gameState) {
    // Show waiting message if in LOBBY or if cards haven't been generated yet
    if (gameState.status === GameStatus.LOBBY || (!contractCards || contractCards.length === 0)) {
      return (
        <div className="w-full max-w-6xl mx-auto p-6">
          <div className="text-center py-12 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-lg text-blue-800">Waiting for game to start...</p>
            <p className="text-sm text-blue-600 mt-2">
              {gameState.status === GameStatus.LOBBY && (!contractCards || contractCards.length === 0)
                ? "The lobby deadline has passed. Someone needs to click 'Start Game' to generate cards."
                : "The game will begin when cards are generated."}
            </p>
          </div>
        </div>
      );
    }

    // Show resolution phase if game is in RESOLUTION OR if player has committed (visual transition)
    if (isInResolutionPhase) {
      // Show player's selected cards if they committed
      const playerSelectedCards = playerChoice?.committed && playerChoice.selectedCards
        ? playerChoice.selectedCards.map((cardNum) => {
            const card = parsedCards.find((c) => c.cardNumber === Number(cardNum));
            return card;
          }).filter((c) => c !== undefined) as Card[]
        : [];

      return (
        <div className="w-full max-w-6xl mx-auto p-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {hasCommitted && gameState?.status === GameStatus.CHOICE 
                ? "Choices Committed - Waiting for Resolution"
                : "Waiting for Resolution"}
            </h2>
            <p className="text-lg text-purple-800 mb-4">
              {hasCommitted && gameState?.status === GameStatus.CHOICE
                ? "Your choices are committed. Waiting for choice phase to end..."
                : "Waiting for price resolution..."}
            </p>
            {gameState?.status === GameStatus.RESOLUTION && (
              <p className="text-sm text-purple-600 mb-6">
                Time remaining: {formatTimeRemaining(resolutionTimeRemaining)}
              </p>
            )}
            
            {/* Show player's committed choices */}
            {playerSelectedCards.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Selected Cards</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 justify-center max-w-4xl mx-auto">
                  {playerSelectedCards.map((card, index) => (
                    <div key={`${card.cardNumber}-${index}`} className="flex justify-center">
                      <PredictionCard
                        card={card}
                        isSelected={true}
                        onClick={() => {}} // Disabled in resolution phase
                        disabled={true}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (gameState.status === GameStatus.ENDED) {
      return (
        <div className="w-full max-w-6xl mx-auto p-6">
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-lg text-gray-800">Game has ended</p>
            <p className="text-sm text-gray-600 mt-2">Check results to see your score!</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Your Cards</h2>
        <p className="text-gray-600">Choose {maxSelections} prediction cards to commit</p>

        {/* Choice Phase Timer */}
        {gameState?.status === GameStatus.CHOICE && (
          <div className="mt-4 inline-flex items-center gap-2 bg-green-100 border border-green-200 px-4 py-2 rounded-full">
            <span className="text-sm font-semibold text-green-800">
              ⏱️ {formatTimeRemaining(choiceTimeRemaining)} remaining to choose
            </span>
          </div>
        )}

        {/* Committed Status */}
        {hasCommitted && (
          <div className="mt-4 inline-flex items-center gap-2 bg-blue-100 border border-blue-200 px-4 py-2 rounded-full">
            <span className="text-sm font-semibold text-blue-800">✅ Choices committed</span>
          </div>
        )}
      </div>

      {/* Cards Display */}
      {canShowCards && parsedCards.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-600">
              {hasCommitted
                ? `You committed ${maxSelections} cards`
                : `Select up to ${maxSelections} cards (${selectedCards.length}/${maxSelections} selected)`}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {parsedCards.map((card) => {
              // Check if this card was selected (either in current selection or committed choice)
              let isSelected = false;
              if (hasCommitted && playerChoice) {
                isSelected = playerChoice.selectedCards.some(
                  (cn) => Number(cn) === card.cardNumber
                );
              } else {
                isSelected = selectedCards.some((c) => c.id === card.id);
              }

              const isDisabled = hasCommitted || (!isSelected && selectedCards.length >= maxSelections);

              return (
                <PredictionCard
                  key={card.id}
                  card={card}
                  isSelected={isSelected}
                  onClick={() => handleCardClick(card)}
                  disabled={isDisabled}
                />
              );
            })}
          </div>

          {/* Selection Summary */}
          {!hasCommitted && selectedCards.length > 0 && (
            <div className="mt-6 text-center">
              <p className="text-lg text-gray-700 mb-4">
                You selected {selectedCards.length} card{selectedCards.length !== 1 ? "s" : ""}:
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {selectedCards.map((card) => (
                  <span
                    key={card.id}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {card.asset.symbol}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Commit Choices Button */}
          {!hasCommitted && selectedCards.length === maxSelections && (
            <div className="text-center mt-6">
              <button
                onClick={handleCommitChoices}
                disabled={isCommitting || selectedCards.length !== maxSelections}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
              >
                {isCommitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                    Committing...
                  </>
                ) : (
                  <>✅ Commit {maxSelections} Selected Cards</>
                )}
              </button>
            </div>
          )}

        </div>
      )}

      {/* Waiting for cards */}
      {canShowCards && parsedCards.length === 0 && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading cards...</p>
        </div>
      )}
    </div>
  );
}
