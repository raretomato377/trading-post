import { PredictionType } from "@/types/card";

// Prediction types configuration
export const PREDICTION_TYPES = [
  PredictionType.PRICE_UP,
  PredictionType.PRICE_DOWN,
  PredictionType.PRICE_ABOVE,
  PredictionType.PRICE_BELOW,
  PredictionType.MARKET_CAP_ABOVE,
  PredictionType.VOLUME_ABOVE,
  PredictionType.PERCENTAGE_CHANGE,
];

// Direction options (for percentage_change and general direction)
export const DIRECTIONS = ["up", "down"];

// Target value ranges (for price_above, price_below, market_cap_above, volume_above)
// These represent percentage offsets from current price
export const TARGET_RANGES = [
  0.01, // 1%
  0.02, // 2%
  0.03, // 3%
  0.05, // 5%
  0.10, // 10%
  0.15, // 15%
  0.20, // 20%
  0.25, // 25%
  0.30, // 30%
  0.50, // 50%
];

// Percentage change ranges (for percentage_change type)
export const PERCENTAGE_CHANGE_RANGES = [
  0.01, // 1%
  0.02, // 2%
  0.03, // 3%
  0.05, // 5%
  0.10, // 10%
  0.15, // 15%
  0.20, // 20%
  0.25, // 25%
  0.30, // 30%
  0.50, // 50%
];

// Get prediction type by index
export function getPredictionTypeByIndex(index: number): PredictionType {
  return PREDICTION_TYPES[index % PREDICTION_TYPES.length];
}

// Get direction by index
export function getDirectionByIndex(index: number): "up" | "down" {
  return DIRECTIONS[index % DIRECTIONS.length] as "up" | "down";
}

// Get target range by index
export function getTargetRangeByIndex(index: number): number {
  return TARGET_RANGES[index % TARGET_RANGES.length];
}

// Get percentage change range by index
export function getPercentageChangeRangeByIndex(index: number): number {
  return PERCENTAGE_CHANGE_RANGES[index % PERCENTAGE_CHANGE_RANGES.length];
}

