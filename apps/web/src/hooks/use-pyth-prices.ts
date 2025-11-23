import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi } from "viem";
import { getPriceUpdateDataForAssets, estimateUpdateFee } from "@/lib/pyth-service";

// Pyth contract ABI (minimal - just what we need)
const PYTH_ABI = parseAbi([
  "function updatePriceFeeds(bytes[] calldata priceUpdateData) payable",
  "function getUpdateFee(bytes[] calldata priceUpdateData) view returns (uint256)",
  "function getPrice(bytes32 priceId) view returns ((int64 price, uint64 conf, int32 expo, uint256 publishTime))",
]);

// Pyth contract addresses for Celo
const PYTH_CONTRACTS = {
  alfajores: process.env.NEXT_PUBLIC_PYTH_CONTRACT_ADDRESS_ALFAJORES || "0x...", // Alfajores testnet
  celo: process.env.NEXT_PUBLIC_PYTH_CONTRACT_ADDRESS || "0x...", // Celo Mainnet
};

export function usePythPrices() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * Update Pyth price feeds for given assets
   * This implements Option 1: Frontend calls Pyth contract directly
   */
  const updatePrices = useCallback(async (assetIds: string[]) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch price update data from Hermes
      const { priceIds, updateData } = await getPriceUpdateDataForAssets(assetIds);
      
      // Step 2: Get the network to determine contract address (defaults to mainnet)
      const network = (process.env.NEXT_PUBLIC_CELO_NETWORK || "celo") as keyof typeof PYTH_CONTRACTS;
      const pythAddress = PYTH_CONTRACTS[network];
      
      if (!pythAddress || pythAddress === "0x...") {
        throw new Error("Pyth contract address not configured");
      }
      
      // Step 3: Estimate fee (or get from contract)
      const estimatedFee = estimateUpdateFee(updateData);
      
      // Step 4: Call updatePriceFeeds on Pyth contract
      writeContract({
        address: pythAddress as `0x${string}`,
        abi: PYTH_ABI,
        functionName: "updatePriceFeeds",
        args: [updateData as `0x${string}`[]],
        value: estimatedFee,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to update prices");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [address, writeContract]);

  return {
    updatePrices,
    loading: loading || isPending || isConfirming,
    error: error || writeError,
    hash,
    isSuccess,
  };
}

