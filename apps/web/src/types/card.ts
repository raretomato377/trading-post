// Card prediction types
// These enum values are used in card-parser.ts, card-config.ts, and prediction-card.tsx
/* eslint-disable no-unused-vars */
export enum PredictionType {
  PRICE_UP = "price_up",
  PRICE_DOWN = "price_down",
  PRICE_ABOVE = "price_above",
  PRICE_BELOW = "price_below",
  MARKET_CAP_ABOVE = "market_cap_above",
  VOLUME_ABOVE = "volume_above",
  PERCENTAGE_CHANGE = "percentage_change",
}
/* eslint-enable no-unused-vars */

// Card interface
export interface Card {
  id: string;
  cardNumber: number; // The 4-digit number from contract
  asset: Asset;
  predictionType: PredictionType;
  targetValue?: number; // For price_above, price_below, etc.
  percentageChange?: number; // For percentage_change
  direction?: "up" | "down"; // For percentage_change
}

// Asset interface
export interface Asset {
  id: string;
  name: string;
  symbol: string;
  pythPriceId: string; // Pyth price feed ID
  type: "crypto" | "stock";
}

// Parsed card attributes
export interface CardAttributes {
  assetIndex: number;
  predictionTypeIndex: number;
  directionIndex: number;
  targetIndex: number;
}

