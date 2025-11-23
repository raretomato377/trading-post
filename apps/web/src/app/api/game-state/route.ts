import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { celo } from 'viem/chains';
import { TRADING_CARD_GAME_CONTRACT } from '@/config/contracts';

// Minimal ABI for the functions we need
const GAME_ABI = parseAbi([
  'function getGameState(uint256) view returns (uint8, uint256, uint256, uint256, uint256, uint256, uint256)',
  'function getGameStateWithPlayer(uint256, address) view returns (uint8, uint256, uint256, uint256, uint256, uint256, uint256, bool, uint256[3])',
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

    // Use getGameStateWithPlayer if playerAddress is provided, otherwise use getGameState
    const usePlayerSpecificState = !!playerAddress && playerAddress !== '0x0000000000000000000000000000000000000000';
    
    // Call all contract functions in parallel
    const [gameStateWithPlayer, players, cards] = await Promise.all([
      // getGameStateWithPlayer or getGameState
      usePlayerSpecificState
        ? publicClient.readContract({
            address: TRADING_CARD_GAME_CONTRACT.address,
            abi: GAME_ABI,
            functionName: 'getGameStateWithPlayer',
            args: [gameIdBigInt, playerAddress as `0x${string}`],
          }).catch((err) => {
            console.error('Error calling getGameStateWithPlayer:', err);
            // Fallback to regular getGameState if the new function doesn't exist yet
            return publicClient.readContract({
              address: TRADING_CARD_GAME_CONTRACT.address,
              abi: GAME_ABI,
              functionName: 'getGameState',
              args: [gameIdBigInt],
            }).then((state) => [
              state[0], state[1], state[2], state[3], state[4], state[5], state[6],
              false, // playerHasCommitted
              [0n, 0n, 0n] as [bigint, bigint, bigint], // playerSelectedCards
            ]);
          })
        : publicClient.readContract({
            address: TRADING_CARD_GAME_CONTRACT.address,
            abi: GAME_ABI,
            functionName: 'getGameState',
            args: [gameIdBigInt],
          }).then((state) => [
            state[0], state[1], state[2], state[3], state[4], state[5], state[6],
            false, // playerHasCommitted
            [0n, 0n, 0n] as [bigint, bigint, bigint], // playerSelectedCards
          ]).catch((err) => {
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
    ]);
    
    // Extract game state and player-specific data
    // gameStateWithPlayer is either:
    // - [status, startTime, lobbyDeadline, choiceDeadline, resolutionDeadline, playerCount, cardCount, playerHasCommitted, playerSelectedCards] from getGameStateWithPlayer
    // - [status, startTime, lobbyDeadline, choiceDeadline, resolutionDeadline, playerCount, cardCount, false, [0n, 0n, 0n]] from getGameState fallback
    const storedStatus = Number(gameStateWithPlayer[0]);
    const startTime = BigInt(gameStateWithPlayer[1] as bigint);
    const lobbyDeadline = BigInt(gameStateWithPlayer[2] as bigint);
    const choiceDeadline = BigInt(gameStateWithPlayer[3] as bigint);
    const resolutionDeadline = BigInt(gameStateWithPlayer[4] as bigint);
    const playerCount = BigInt(gameStateWithPlayer[5] as bigint);
    const cardCount = BigInt(gameStateWithPlayer[6] as bigint);
    const playerHasCommitted = (gameStateWithPlayer[7] ?? false) as boolean;
    const playerSelectedCards = (gameStateWithPlayer[8] ?? [0n, 0n, 0n]) as [bigint, bigint, bigint];

    // Compute the current phase based on timestamps (not stored status)
    // This ensures we get the correct phase even if the contract status hasn't been updated
    // IMPORTANT: If cards haven't been generated, stay in LOBBY even if deadline passed
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    let computedStatus = storedStatus;
    
    // Only compute phase if game is not explicitly ENDED
    if (computedStatus !== 4) { // 4 = ENDED
      // If cards haven't been generated, game is still in LOBBY (waiting for startGame to be called)
      if (cardCount === 0n) {
        computedStatus = 0; // LOBBY - waiting for startGame
      } else if (currentTime < lobbyDeadline) {
        computedStatus = 0; // LOBBY
      } else if (currentTime < choiceDeadline) {
        computedStatus = 2; // CHOICE
      } else if (currentTime < resolutionDeadline) {
        computedStatus = 3; // RESOLUTION
      } else {
        // Resolution deadline passed, but game not ended yet
        computedStatus = 3; // Still RESOLUTION until endGame is called
      }
    }

    // Format the response
    const response = {
      gameState: {
        status: computedStatus, // Use computed status based on timestamps
        startTime: startTime.toString(),
        lobbyDeadline: lobbyDeadline.toString(),
        choiceDeadline: choiceDeadline.toString(),
        resolutionDeadline: resolutionDeadline.toString(),
        playerCount: playerCount.toString(),
        cardCount: cardCount.toString(),
      },
      players: players || [],
      cards: cards?.map((c) => c.toString()) || [],
      playerChoice: usePlayerSpecificState
        ? {
            selectedCards: playerSelectedCards.map((c) => c.toString()),
            committedAt: '0', // Not returned by getGameStateWithPlayer, but we can get it separately if needed
            committed: playerHasCommitted,
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

