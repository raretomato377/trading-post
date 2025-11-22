"use client";

import { Card, PredictionType } from "@/types/card";

interface PredictionCardProps {
  card: Card;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function PredictionCard({ card, isSelected, onClick, disabled }: PredictionCardProps) {
  const getPredictionText = () => {
    switch (card.predictionType) {
      case PredictionType.PRICE_UP:
        return `${card.asset.symbol} price will go UP`;
      case PredictionType.PRICE_DOWN:
        return `${card.asset.symbol} price will go DOWN`;
      case PredictionType.PRICE_ABOVE:
        return `${card.asset.symbol} price will go ABOVE ${(card.targetValue! * 100).toFixed(0)}%`;
      case PredictionType.PRICE_BELOW:
        return `${card.asset.symbol} price will go BELOW ${(card.targetValue! * 100).toFixed(0)}%`;
      case PredictionType.MARKET_CAP_ABOVE:
        return `${card.asset.symbol} market cap will go ABOVE ${(card.targetValue! * 100).toFixed(0)}%`;
      case PredictionType.VOLUME_ABOVE:
        return `${card.asset.symbol} volume will go ABOVE ${(card.targetValue! * 100).toFixed(0)}%`;
      case PredictionType.PERCENTAGE_CHANGE:
        return `${card.asset.symbol} will ${card.direction === "up" ? "INCREASE" : "DECREASE"} by ${(card.percentageChange! * 100).toFixed(0)}%`;
      default:
        return "Unknown prediction";
    }
  };

  const getCardColor = () => {
    switch (card.predictionType) {
      case PredictionType.PRICE_UP:
        return "bg-green-50 border-green-300";
      case PredictionType.PRICE_DOWN:
        return "bg-red-50 border-red-300";
      case PredictionType.PRICE_ABOVE:
      case PredictionType.MARKET_CAP_ABOVE:
      case PredictionType.VOLUME_ABOVE:
        return "bg-blue-50 border-blue-300";
      case PredictionType.PRICE_BELOW:
        return "bg-orange-50 border-orange-300";
      case PredictionType.PERCENTAGE_CHANGE:
        return card.direction === "up" ? "bg-purple-50 border-purple-300" : "bg-pink-50 border-pink-300";
      default:
        return "bg-gray-50 border-gray-300";
    }
  };

  const getIcon = () => {
    switch (card.predictionType) {
      case PredictionType.PRICE_UP:
        return "📈";
      case PredictionType.PRICE_DOWN:
        return "📉";
      case PredictionType.PRICE_ABOVE:
      case PredictionType.MARKET_CAP_ABOVE:
      case PredictionType.VOLUME_ABOVE:
        return "⬆️";
      case PredictionType.PRICE_BELOW:
        return "⬇️";
      case PredictionType.PERCENTAGE_CHANGE:
        return card.direction === "up" ? "📊" : "📉";
      default:
        return "🎴";
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative rounded-xl p-6 transition-all duration-200 border-2
        ${getCardColor()}
        ${isSelected 
          ? 'ring-4 ring-blue-500 scale-105 shadow-2xl' 
          : 'hover:scale-105 hover:shadow-xl'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold z-10">
          ✓
        </div>
      )}

      {/* Card Content */}
      <div className="text-center">
        {/* Card Number (from contract) */}
        <div className="absolute top-2 left-2 bg-gray-800 text-white rounded-md px-2 py-1 text-xs font-mono font-bold">
          #{card.cardNumber.toString().padStart(4, '0')}
        </div>
        
        {/* Icon */}
        <div className="text-4xl mb-3">{getIcon()}</div>
        
        {/* Asset Name */}
        <div className="font-bold text-lg text-gray-900 mb-2">
          {card.asset.name}
        </div>
        
        {/* Asset Symbol */}
        <div className="text-sm text-gray-600 mb-3">
          {card.asset.symbol}
        </div>
        
        {/* Prediction Text */}
        <div className="text-sm font-semibold text-gray-800 leading-tight">
          {getPredictionText()}
        </div>
      </div>
    </button>
  );
}

