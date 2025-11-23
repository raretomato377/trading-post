import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { celo } from "viem/chains";
import { TRADING_CARD_GAME_CONTRACT, CELO_MAINNET_CHAIN_ID } from "@/config/contracts";

// Verify the request is from Vercel Cron
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, verify it
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // In production, Vercel automatically adds the authorization header
  // For local testing, we can allow requests without it (but should set CRON_SECRET in production)
  return true;
}

// Game status enum (matches contract)
const GAME_STATUS = {
  LOBBY: 0,
  ACTIVE: 1,
  CHOICE: 2,
  RESOLUTION: 3,
  ENDED: 4,
} as const;

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Create a public client to read from the contract
    const publicClient = createPublicClient({
      chain: celo,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://forno.celo.org"),
    });

    // Get contract ABI
    const contractABI = parseAbi([
      "function getGameState(uint256) view returns (uint8, uint256, uint256, uint256, uint256, uint256, uint256)",
      "function endGame(uint256)",
      "function nextGameId() view returns (uint256)",
    ]);

    // Get the next game ID to know how many games exist
    // Note: This assumes the contract has a nextGameId function
    // If not, we'll need to track games differently
    let nextGameId = 1n;
    try {
      // Try to read nextGameId if it exists in the contract
      // For now, we'll need to track this differently or add it to the contract
      // As a workaround, we'll check games starting from 1 and increment until we find one that doesn't exist
    } catch (error) {
      console.log("Could not read nextGameId, will iterate games");
    }

    const endedGames: bigint[] = [];
    const errors: string[] = [];

    // Check games starting from 1 (we'll need a better way to track this)
    // For now, check first 100 games
    for (let gameId = 1n; gameId <= 100n; gameId++) {
      try {
        // Get game state
        const gameState = await publicClient.readContract({
          address: TRADING_CARD_GAME_CONTRACT.address as `0x${string}`,
          abi: contractABI,
          functionName: "getGameState",
          args: [gameId],
        });

        const [status, , , , resolutionDeadline] = gameState;

        // Check if game is in RESOLUTION state and deadline has passed
        if (status === GAME_STATUS.RESOLUTION) {
          const currentTime = BigInt(Math.floor(Date.now() / 1000));
          if (currentTime >= resolutionDeadline) {
            // Game is ready to end
            try {
              // Call endGame
              // Note: This requires a wallet with write access
              // For a cron job, we'd need to use a private key or service account
              // This is a placeholder - you'll need to set up a wallet provider
              console.log(`Game ${gameId} is ready to end, but endGame requires write access`);
              
              // TODO: Implement actual endGame call with wallet provider
              // For now, just log it
              endedGames.push(gameId);
            } catch (error) {
              errors.push(`Failed to end game ${gameId}: ${error}`);
            }
          }
        }
      } catch (error) {
        // Game doesn't exist or other error, skip it
        if (gameId === 1n) {
          // If first game doesn't exist, probably no games yet
          break;
        }
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      checkedGames: 100,
      gamesEnded: endedGames.length,
      endedGameIds: endedGames.map((id) => id.toString()),
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

