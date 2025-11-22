import { Card, CardAttributes, PredictionType } from "@/types/card";
import { getAssetByIndex } from "./assets";
import {
  getPredictionTypeByIndex,
  getDirectionByIndex,
  getTargetRangeByIndex,
  getPercentageChangeRangeByIndex,
} from "./card-config";

/**
 * Parse a 4-digit number into card attributes using modulo operations
 * This is a scalable framework that can be extended with new attributes
 * 
 * @param cardNumber - 4-digit number (0000-9999)
 * @returns Parsed card attributes
 */
export function parseCardNumber(cardNumber: number): CardAttributes {
  // Ensure number is in valid range
  const num = Math.max(0, Math.min(9999, cardNumber));

  // Extract attributes using modulo operations
  // This allows for easy extension by adjusting the modulo divisors
  const assetIndex = num % 10; // Last digit (0-9) → asset index
  const predictionTypeIndex = Math.floor(num / 10) % 10; // Second digit → prediction type
  const directionIndex = Math.floor(num / 100) % 10; // Third digit → direction
  const targetIndex = Math.floor(num / 1000) % 10; // First digit → target value

  return {
    assetIndex,
    predictionTypeIndex,
    directionIndex,
    targetIndex,
  };
}

/**
 * Convert parsed attributes into a Card object
 * 
 * @param cardNumber - The original 4-digit number
 * @param attributes - Parsed card attributes
 * @returns Complete Card object
 */
export function attributesToCard(cardNumber: number, attributes: CardAttributes): Card {
  const asset = getAssetByIndex(attributes.assetIndex);
  if (!asset) {
    throw new Error(`Invalid asset index: ${attributes.assetIndex}`);
  }

  const predictionType = getPredictionTypeByIndex(attributes.predictionTypeIndex);
  
  const card: Card = {
    id: `card-${cardNumber}`,
    cardNumber,
    asset,
    predictionType,
  };

  // Add type-specific attributes
  switch (predictionType) {
    case PredictionType.PRICE_ABOVE:
    case PredictionType.PRICE_BELOW:
    case PredictionType.MARKET_CAP_ABOVE:
    case PredictionType.VOLUME_ABOVE:
      card.targetValue = getTargetRangeByIndex(attributes.targetIndex);
      break;
    
    case PredictionType.PERCENTAGE_CHANGE:
      card.percentageChange = getPercentageChangeRangeByIndex(attributes.targetIndex);
      card.direction = getDirectionByIndex(attributes.directionIndex);
      break;
    
    case PredictionType.PRICE_UP:
    case PredictionType.PRICE_DOWN:
      // No additional attributes needed
      break;
  }

  return card;
}

/**
 * Parse a 4-digit number directly into a Card object
 * 
 * @param cardNumber - 4-digit number (0000-9999)
 * @returns Complete Card object
 */
export function parseCard(cardNumber: number): Card {
  const attributes = parseCardNumber(cardNumber);
  return attributesToCard(cardNumber, attributes);
}

/**
 * Parse multiple card numbers into Card objects
 * 
 * @param cardNumbers - Array of 4-digit numbers
 * @returns Array of Card objects
 */
export function parseCards(cardNumbers: number[]): Card[] {
  return cardNumbers.map(parseCard);
}

