import { getPythPriceId } from "./assets";

// Hermes API endpoint
const HERMES_API_URL = process.env.NEXT_PUBLIC_HERMES_API_URL || "https://hermes.pyth.network";

/**
 * Fetch price update data from Hermes API
 * This is step 1 of the Pyth pull oracle flow
 * 
 * @param priceIds - Array of Pyth price feed IDs
 * @returns Price update data (bytes array) ready for on-chain submission
 */
export async function fetchPriceUpdateData(priceIds: string[]): Promise<string[]> {
  try {
    // Build query string for Hermes API
    const queryParams = priceIds.map((id) => `ids[]=${id}`).join("&");
    const url = `${HERMES_API_URL}/v2/updates/price/latest?${queryParams}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Hermes API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Hermes returns price update data in a specific format
    // The response contains binary data that needs to be formatted for the contract
    // TODO: Parse the response correctly based on Hermes API documentation
    // For now, return the raw data - this will need to be adjusted based on actual API response format
    
    if (!data.parsed || !Array.isArray(data.parsed)) {
      throw new Error("Invalid response format from Hermes API");
    }
    
    // Convert to hex strings (bytes array format)
    return data.parsed.map((update: any) => {
      // TODO: Convert update to proper bytes format
      // This depends on the exact format Hermes returns
      return update;
    });
  } catch (error) {
    console.error("Error fetching price update data from Hermes:", error);
    throw error;
  }
}

/**
 * Get price update data for specific assets
 * 
 * @param assetIds - Array of asset IDs (e.g., ["BTC", "ETH"])
 * @returns Price update data ready for contract
 */
export async function getPriceUpdateDataForAssets(assetIds: string[]): Promise<{
  priceIds: string[];
  updateData: string[];
}> {
  // Get Pyth price IDs for assets
  const priceIds = assetIds
    .map((assetId) => getPythPriceId(assetId))
    .filter((id): id is string => id !== undefined);
  
  if (priceIds.length === 0) {
    throw new Error("No valid price IDs found for assets");
  }
  
  // Fetch update data from Hermes
  const updateData = await fetchPriceUpdateData(priceIds);
  
  return {
    priceIds,
    updateData,
  };
}

/**
 * Estimate the fee for updating price feeds
 * This is a rough estimate - actual fee should be calculated from the contract
 * 
 * @param priceUpdateData - Price update data array
 * @returns Estimated fee in wei
 */
export function estimateUpdateFee(priceUpdateData: string[]): bigint {
  // Rough estimate: ~1000 gas per price feed update
  // Gas price varies, but for Celo it's typically around 0.001 gwei
  // This is a placeholder - actual fee should come from contract.getUpdateFee()
  const baseFee = BigInt(1000); // base gas
  const perUpdateFee = BigInt(500); // gas per update
  const gasPrice = BigInt(1000000000); // 1 gwei in wei
  
  const totalGas = baseFee + (perUpdateFee * BigInt(priceUpdateData.length));
  return totalGas * gasPrice;
}

