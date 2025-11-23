import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { celo } from 'viem/chains';
import { TRADING_CARD_GAME_CONTRACT } from '@/config/contracts';

// Minimal ABI for the functions we need
const GAME_ABI = parseAbi([
  'function getGameState(uint256) view returns (uint8, uint256, uint256, uint256, uint256, uint256, uint256)',
  'function getGamePlayers(uint256) view returns (address[])',
  'function getGameCards(uint256) view returns (uint256[])',
  'function getPlayerChoices(uint256, address) view returns (uint256[3], uint256, bool)',
]);

// Use environment variable or default to Celo Mainnet RPC
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org';

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const gameId = searchParams.get('gameId');
    const playerAddress = searchParams.get('playerAddress');

    // Validate gameId - reject undefined, null, empty string, or "0"
    if (!gameId || gameId === 'undefined' || gameId === 'null' || gameId === '' || gameId === '0') {
      return NextResponse.json(
        { error: 'Invalid or missing gameId parameter' },
        { status: 400 }
      );
    }
    
    // Try to parse gameId to ensure it's a valid number
    let gameIdBigInt: bigint;
    try {
      gameIdBigInt = BigInt(gameId);
      if (gameIdBigInt <= 0n) {
        return NextResponse.json(
          { error: 'gameId must be greater than 0' },
          { status: 400 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'gameId must be a valid number' },
        { status: 400 }
      );
    }

    const publicClient = createPublicClient({
      chain: celo,
      transport: http(RPC_URL),
    });

    // gameIdBigInt is already validated and set above

    // Call all contract functions in parallel
    const [gameState, players, cards, playerChoice] = await Promise.all([
      // getGameState
      publicClient.readContract({
        address: TRADING_CARD_GAME_CONTRACT.address,
        abi: GAME_ABI,
        functionName: 'getGameState',
        args: [gameIdBigInt],
      }).catch((err) => {
        console.error('Error calling getGameState:', err);
        throw new Error(`Failed to get game state: ${err instanceof Error ? err.message : String(err)}`);
      }),
      // getGamePlayers
      publicClient.readContract({
        address: TRADING_CARD_GAME_CONTRACT.address,
        abi: GAME_ABI,
        functionName: 'getGamePlayers',
        args: [gameIdBigInt],
      }).catch((err) => {
        console.error('Error calling getGamePlayers:', err);
        throw new Error(`Failed to get game players: ${err instanceof Error ? err.message : String(err)}`);
      }),
      // getGameCards
      publicClient.readContract({
        address: TRADING_CARD_GAME_CONTRACT.address,
        abi: GAME_ABI,
        functionName: 'getGameCards',
        args: [gameIdBigInt],
      }).catch((err) => {
        console.error('Error calling getGameCards:', err);
        throw new Error(`Failed to get game cards: ${err instanceof Error ? err.message : String(err)}`);
      }),
      // getPlayerChoices (only if playerAddress provided)
      playerAddress
        ? publicClient.readContract({
            address: TRADING_CARD_GAME_CONTRACT.address,
            abi: GAME_ABI,
            functionName: 'getPlayerChoices',
            args: [gameIdBigInt, playerAddress as `0x${string}`],
          }).catch(() => null) // Return null if player hasn't made choices yet
        : Promise.resolve(null),
    ]);

    // Format the response
    const response = {
      gameState: gameState
        ? {
            status: Number(gameState[0]),
            startTime: gameState[1].toString(),
            lobbyDeadline: gameState[2].toString(),
            choiceDeadline: gameState[3].toString(),
            resolutionDeadline: gameState[4].toString(),
            playerCount: gameState[5].toString(),
            cardCount: gameState[6].toString(),
          }
        : null,
      players: players || [],
      cards: cards?.map((c) => c.toString()) || [],
      playerChoice: playerChoice
        ? {
            selectedCards: playerChoice[0].map((c) => c.toString()),
            committedAt: playerChoice[1].toString(),
            committed: playerChoice[2],
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Game state API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch game state',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

