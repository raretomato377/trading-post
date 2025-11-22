"use client";

import { useState, useEffect } from "react";
import { useReadContract, useAccount } from "wagmi";
import { Card } from "@/types/card";
import { parseCards } from "@/lib/card-parser";
import { useRoundTimer, formatTimeRemaining } from "@/hooks/use-round-timer";
import { PredictionCard } from "./prediction-card";
import { RANDOM_NUMBERS_CONTRACT, CELO_SEPOLIA_CHAIN_ID } from "@/config/contracts";
import { getRandomCardNumbers } from "@/lib/mock-contract";
import { useMiniApp } from "@/contexts/miniapp-context";

interface CardGameProps {
  onCardsSelected?: (cards: Card[]) => void;
  onProceed?: (selectedCards: Card[]) => void;
  maxSelections?: number; // Default: 3
  cardCount?: number; // Number of cards to generate (default: 10, but contract returns 4)
}

export function CardGame({ 
  onCardsSelected, 
  onProceed, 
  maxSelections = 3,
  cardCount = 10 
}: CardGameProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { currentRound, timeUntilNextRound, canGenerateCards } = useRoundTimer();
  const { isConnected } = useAccount();

  // READ from smart contract - only if wallet is connected
  const { data: contractData, isLoading, refetch } = useReadContract({
    address: RANDOM_NUMBERS_CONTRACT.address,
    abi: RANDOM_NUMBERS_CONTRACT.abi,
    functionName: 'getAllNumbers',
    chainId: CELO_SEPOLIA_CHAIN_ID,
    query: {
      enabled: isConnected, // Only query if wallet is connected
    },
  });

  // For localhost and Farcaster testing, allow card generation at any time
  // In production, this will respect the round timer
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // Check if we're in Farcaster (has context means we're in Farcaster/Warpcast)
  const { context: miniappContext } = useMiniApp();
  const isInFarcaster = !!miniappContext;
  
  // Generation rules:
  // - Localhost: always allow (testing)
  // - Farcaster: require wallet + allow anytime (testing)
  // - Web (not Farcaster): allow without wallet anytime (demo mode), or with wallet respect round timer
  let canGenerate: boolean;
  if (isLocalhost) {
    canGenerate = true; // Always allow on localhost
  } else if (isInFarcaster) {
    canGenerate = isConnected; // In Farcaster, require wallet
  } else {
    // On web (not Farcaster): allow without wallet anytime, or with wallet respect timer
    canGenerate = !isConnected ? true : canGenerateCards;
  }

  // Generate cards from contract (if wallet connected) or mock (if not)
  const generateCards = async () => {
    if (isGenerating || !canGenerate) return;
    
    setIsGenerating(true);
    try {
      let numberArray: number[] = [];
      let source = '';

      // Try to get numbers from contract if wallet is connected
      if (isConnected) {
        try {
          const result = await refetch();
          if (result.data) {
            // Convert contract numbers (uint256[4]) to numbers
            const numbers = result.data as readonly bigint[];
            numberArray = Array.from(numbers).map(n => Number(n));
            source = 'contract';
            console.log('📊 Numbers from Smart Contract:', numberArray);
            console.log('📍 Contract Address:', RANDOM_NUMBERS_CONTRACT.address);
          }
        } catch (contractError) {
          console.warn('⚠️ Contract call failed, falling back to mock:', contractError);
          // Fall through to mock generation
        }
      }

      // If no contract data, use mock generation
      if (numberArray.length === 0) {
        // Generate first 4 numbers from mock (simulating contract)
        const mockNumbers = await getRandomCardNumbers(4);
        numberArray = mockNumbers;
        source = 'mock';
        console.log('🎲 Using mock card numbers (no wallet connected):', numberArray);
      }

      // Parse numbers into prediction cards using our parser framework
      // First 4 cards use numbers from contract/mock, rest are generated client-side
      let numbersToParse = [...numberArray];
      
      // If we need more cards than contract provides, generate additional random numbers
      if (cardCount > numberArray.length) {
        const additionalNeeded = cardCount - numberArray.length;
        for (let i = 0; i < additionalNeeded; i++) {
          numbersToParse.push(Math.floor(Math.random() * 10000));
        }
      }
      
      // Parse all numbers into prediction cards
      const finalNumbers = numbersToParse.slice(0, cardCount);
      const parsedCards = parseCards(finalNumbers);
      
      setCards(parsedCards);
      setSelectedCards([]);
      setHasGenerated(true);
      
      // Show info about data source
      if (source === 'mock' && !isLocalhost) {
        console.log('ℹ️ Cards generated without wallet. Connect wallet to use on-chain data.');
      }
    } catch (error) {
      console.error("Failed to generate cards:", error);
      alert("Failed to generate cards. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCardClick = (card: Card) => {
    const isSelected = selectedCards.some((c) => c.id === card.id);
    
    if (isSelected) {
      // Deselect
      setSelectedCards(selectedCards.filter((c) => c.id !== card.id));
    } else {
      // Select (if under limit)
      if (selectedCards.length < maxSelections) {
        const newSelection = [...selectedCards, card];
        setSelectedCards(newSelection);
        if (onCardsSelected) {
          onCardsSelected(newSelection);
        }
      }
    }
  };

  const handleProceed = async () => {
    if (selectedCards.length === 0) return;
    
    // TODO: Submit selection to contract when ready
    console.log("Proceeding with cards:", selectedCards);
    
    if (onProceed) {
      onProceed(selectedCards);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Trading Card Game</h2>
        <p className="text-gray-600">Generate prediction cards and select your favorites!</p>
        
        {/* Round Timer */}
        <div className="mt-4 inline-flex items-center gap-2 bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full">
          <span className="text-sm text-gray-700">
            Round {currentRound} • {formatTimeRemaining(timeUntilNextRound)} remaining
          </span>
        </div>
      </div>

      {/* Generate Cards Button */}
      <div className="mb-8 text-center">
        <button
          onClick={generateCards}
          disabled={isGenerating || (isLoading && isConnected) || !canGenerate}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
        >
          {isGenerating || (isLoading && isConnected) ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
              {isLoading && isConnected ? 'Loading from Contract...' : 'Generating...'}
            </>
          ) : (
            <>🎴 Generate {cardCount} New Cards</>
          )}
        </button>
        
        {!canGenerate && isInFarcaster && !isConnected && (
          <p className="text-sm text-yellow-600 mt-2">
            ⚠️ Wallet required in Farcaster. Please connect your wallet to generate cards.
          </p>
        )}
        
        {!canGenerate && !isInFarcaster && !isLocalhost && (
          <p className="text-sm text-gray-500 mt-2">
            New cards available at the start of the next round (first 30 minutes of each hour)
          </p>
        )}
        
        {canGenerate && !isConnected && !isLocalhost && !isInFarcaster && (
          <p className="text-xs text-gray-500 mt-2">
            💡 No wallet connected - using demo mode. Connect wallet for on-chain data.
          </p>
        )}
        
        {!canGenerate && !isLocalhost && (
          <p className="text-sm text-gray-500 mt-2">
            New cards available at the start of the next round
          </p>
        )}
      </div>

      {/* Cards Display */}
      {hasGenerated && cards.length > 0 && (
        <div className="mb-8">
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-600">
              Select up to {maxSelections} cards ({selectedCards.length}/{maxSelections} selected)
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {cards.map((card) => {
              const isSelected = selectedCards.some((c) => c.id === card.id);
              const isDisabled = !isSelected && selectedCards.length >= maxSelections;
              
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
          {selectedCards.length > 0 && (
            <div className="mt-6 text-center">
              <p className="text-lg text-gray-700 mb-4">
                You selected {selectedCards.length} card{selectedCards.length !== 1 ? 's' : ''}:
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

          {/* Proceed Button */}
          {selectedCards.length > 0 && (
            <div className="text-center">
              <button
                onClick={handleProceed}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                ✅ Proceed with {selectedCards.length} Selected Card{selectedCards.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!hasGenerated && (
        <div className="text-center text-gray-500 mt-8">
          <p>Click the button above to generate {cardCount} random prediction cards!</p>
          <p className="text-sm mt-2">Each card predicts the movement of a crypto or stock asset.</p>
        </div>
      )}
    </div>
  );
}
