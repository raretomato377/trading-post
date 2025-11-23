import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { celo } from 'viem/chains';
import { TRADING_CARD_GAME_CONTRACT } from '@/config/contracts';

// Minimal ABI for the function we need
const GAME_ABI = parseAbi([
  'function getPredictionResult(uint256, uint256) view returns (bool, uint256)',
]);

// Use environment variable or default to Celo Mainnet RPC
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org';

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const gameId = searchParams.get('gameId');
    const cardNumber = searchParams.get('cardNumber');

    // Validate parameters
    if (!gameId || gameId === 'undefined' || gameId === 'null' || gameId === '' || gameId === '0') {
      return NextResponse.json(
        { error: 'Invalid or missing gameId parameter' },
        { status: 400 }
      );
    }
    
    if (!cardNumber || cardNumber === 'undefined' || cardNumber === 'null' || cardNumber === '') {
      return NextResponse.json(
        { error: 'Invalid or missing cardNumber parameter' },
        { status: 400 }
      );
    }
    
    // Try to parse parameters
    let gameIdBigInt: bigint;
    let cardNumberBigInt: bigint;
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
    
    try {
      cardNumberBigInt = BigInt(cardNumber);
    } catch (err) {
      return NextResponse.json(
        { error: 'cardNumber must be a valid number' },
        { status: 400 }
      );
    }

    const publicClient = createPublicClient({
      chain: celo,
      transport: http(RPC_URL),
    });

    // Call getPredictionResult
    const [correct, pointsEarned] = await publicClient.readContract({
      address: TRADING_CARD_GAME_CONTRACT.address,
      abi: GAME_ABI,
      functionName: 'getPredictionResult',
      args: [gameIdBigInt, cardNumberBigInt],
    }).catch((err) => {
      console.error('Error calling getPredictionResult:', err);
      throw new Error(`Failed to get prediction result: ${err instanceof Error ? err.message : String(err)}`);
    });

    return NextResponse.json({
      correct,
      pointsEarned: pointsEarned.toString(),
    });
  } catch (error) {
    console.error('Prediction result API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch prediction result',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

