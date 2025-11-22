"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { RANDOM_NUMBERS_CONTRACT, CELO_SEPOLIA_CHAIN_ID } from "@/config/contracts";

// Card types/suits for variety
const CARD_SUITS = ["♠", "♥", "♦", "♣"];
const CARD_VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface Card {
  suit: string;
  value: string;
  id: string;
}

interface CardGameProps {
  onCardSelected?: (card: Card) => void;
  onProceed?: (selectedCard: Card) => void;
}

export function CardGame({ onCardSelected, onProceed }: CardGameProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [displayNumbers, setDisplayNumbers] = useState<number[]>([]);

  // READ from smart contract - NO transaction needed!
  const { data: contractData, isLoading, refetch } = useReadContract({
    address: RANDOM_NUMBERS_CONTRACT.address,
    abi: RANDOM_NUMBERS_CONTRACT.abi,
    functionName: 'getAllNumbers',
    chainId: CELO_SEPOLIA_CHAIN_ID,
  });

  const generateRandomCards = async () => {
    // Fetch the latest data from the contract
    const result = await refetch();

    if (result.data) {
      // Convert contract numbers (uint256[4]) to cards
      // The contract returns: [7482, 3619, 5834, 9271]
      const numbers = result.data as readonly bigint[];
      const numberArray = Array.from(numbers).map(n => Number(n));

      // Log to console so user can verify
      console.log('📊 Numbers from Smart Contract:', numberArray);
      console.log('📍 Contract Address:', RANDOM_NUMBERS_CONTRACT.address);

      // Store for display
      setDisplayNumbers(numberArray);

      const newCards: Card[] = [];

      // Use first 3 numbers from contract to generate cards
      for (let i = 0; i < Math.min(3, numbers.length); i++) {
        const num = Number(numbers[i]);

        // Use the number to deterministically select suit and value
        const suitIndex = num % CARD_SUITS.length;
        const valueIndex = num % CARD_VALUES.length;

        const suit = CARD_SUITS[suitIndex];
        const value = CARD_VALUES[valueIndex];
        const cardId = `${suit}-${value}-${num}`;

        newCards.push({ suit, value, id: cardId });
      }

      setCards(newCards);
      setSelectedCard(null);
      setHasGenerated(true);
    }
  };

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    if (onCardSelected) {
      onCardSelected(card);
    }
  };

  const handleProceed = () => {
    if (selectedCard && onProceed) {
      onProceed(selectedCard);
    }
  };

  const getCardColor = (suit: string) => {
    return suit === "♥" || suit === "♦" ? "text-red-600" : "text-gray-900";
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Card Game</h2>
        <p className="text-gray-600">Generate cards and choose your favorite!</p>
      </div>

      {/* Generate Cards Button */}
      <div className="mb-8 text-center">
        <button
          onClick={generateRandomCards}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '⏳ Loading from Contract...' : '🎴 Generate Cards from Contract'}
        </button>
      </div>

      {/* Contract Numbers Display */}
      {displayNumbers.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 mb-2">
            Numbers from Smart Contract:
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {displayNumbers.map((num, idx) => (
              <span
                key={idx}
                className="bg-blue-600 text-white px-4 py-2 rounded-md font-mono font-bold text-lg"
              >
                {num}
              </span>
            ))}
          </div>
          <p className="text-xs text-blue-700 mt-2">
            Contract: {RANDOM_NUMBERS_CONTRACT.address.slice(0, 6)}...{RANDOM_NUMBERS_CONTRACT.address.slice(-4)}
          </p>
        </div>
      )}

      {/* Cards Display */}
      {hasGenerated && cards.length > 0 && (
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((card) => {
              const isSelected = selectedCard?.id === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                  className={`
                    relative bg-white rounded-xl shadow-lg p-6 transition-all duration-200
                    ${isSelected 
                      ? 'ring-4 ring-blue-500 scale-105 shadow-2xl' 
                      : 'hover:scale-105 hover:shadow-xl cursor-pointer'
                    }
                  `}
                >
                  {/* Card Content */}
                  <div className={`text-center ${getCardColor(card.suit)}`}>
                    <div className="text-5xl font-bold mb-2">{card.value}</div>
                    <div className="text-6xl">{card.suit}</div>
                  </div>

                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selection Message */}
          {selectedCard && (
            <div className="mt-6 text-center">
              <p className="text-lg text-gray-700 mb-4">
                You selected: <span className="font-bold">{selectedCard.value} {selectedCard.suit}</span>
              </p>
            </div>
          )}

          {/* Proceed Button */}
          {selectedCard && (
            <div className="text-center">
              <button
                onClick={handleProceed}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                ✅ Proceed with Selected Card
              </button>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!hasGenerated && (
        <div className="text-center text-gray-500 mt-8">
          <p>Click the button above to generate 3 random cards!</p>
        </div>
      )}
    </div>
  );
}

