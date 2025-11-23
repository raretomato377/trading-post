import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { TRADING_CARD_GAME_CONTRACT, CELO_SEPOLIA_CHAIN_ID } from "@/config/contracts";
import { parseAbiItem } from "viem";
import { useWatchContractEvent } from "wagmi";
import { useEffect, useState, useCallback } from "react";

// Game status enum (matches contract)
export enum GameStatus {
  LOBBY = 0,
  ACTIVE = 1,
  CHOICE = 2,
  RESOLUTION = 3,
  ENDED = 4,
}

export interface GameState {
  status: GameStatus;
  startTime: bigint;
  lobbyDeadline: bigint;
  choiceDeadline: bigint;
  resolutionDeadline: bigint;
  playerCount: bigint;
  cardCount: bigint;
}

export interface PlayerChoice {
  selectedCards: readonly [bigint, bigint, bigint];
  committedAt: bigint;
  committed: boolean;
}

export interface PredictionResult {
  correct: boolean;
  pointsEarned: bigint;
}

export interface PlayerScore {
  totalPoints: bigint;
  gamesPlayed: bigint;
  gamesWon: bigint;
}

/**
 * Hook to create a new game
 */
export function useCreateGame() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const createGame = () => {
    console.log('🎮 [createGame] Starting createGame...');
    console.log('🎮 [createGame] Contract address:', TRADING_CARD_GAME_CONTRACT.address);
    console.log('🎮 [createGame] Chain ID:', CELO_SEPOLIA_CHAIN_ID);
    
    try {
      writeContract({
        address: TRADING_CARD_GAME_CONTRACT.address,
        abi: TRADING_CARD_GAME_CONTRACT.abi,
        functionName: "createGame",
        chainId: CELO_SEPOLIA_CHAIN_ID,
      });
      console.log('🎮 [createGame] writeContract called successfully');
    } catch (err) {
      console.error('🎮 [createGame] Error calling writeContract:', err);
      throw err;
    }
  };

  // Log transaction status changes
  useEffect(() => {
    if (hash) {
      console.log('🎮 [createGame] Transaction hash:', hash);
      console.log('🎮 [createGame] View on explorer:', `https://celo-sepolia.blockscout.com/tx/${hash}`);
    }
  }, [hash]);

  useEffect(() => {
    if (isPending) {
      console.log('🎮 [createGame] Transaction pending...');
    }
  }, [isPending]);

  useEffect(() => {
    if (isConfirming) {
      console.log('🎮 [createGame] Waiting for confirmation...');
    }
  }, [isConfirming]);

  useEffect(() => {
    if (isSuccess && receipt) {
      console.log('🎮 [createGame] ✅ Transaction confirmed!');
      console.log('🎮 [createGame] Receipt:', receipt);
      
      // Try to extract game ID from events
      if (receipt.logs) {
        console.log('🎮 [createGame] Transaction logs:', receipt.logs);
        // The GameStarted event should contain the gameId
        // We'll need to parse it from the logs
      }
    }
  }, [isSuccess, receipt]);

  useEffect(() => {
    if (error) {
      console.error('🎮 [createGame] ❌ Error:', error);
      console.error('🎮 [createGame] Error details:', {
        name: error?.name,
        message: error?.message,
      });
    }
  }, [error]);

  return {
    createGame,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    receipt,
  };
}

/**
 * Hook to join an existing game
 */
export function useJoinGame(gameId: bigint | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const joinGame = () => {
    if (!gameId) return;
    writeContract({
      address: TRADING_CARD_GAME_CONTRACT.address,
      abi: TRADING_CARD_GAME_CONTRACT.abi,
      functionName: "joinGame",
      args: [gameId],
      chainId: CELO_SEPOLIA_CHAIN_ID,
    });
  };

  return {
    joinGame,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to begin a game (must be called manually after lobby deadline passes)
 * @param gameId The game ID
 * @param gameState Optional game state to validate conditions before calling
 */
export function useBeginGame(gameId: bigint | undefined, gameState?: { lobbyDeadline?: bigint; status?: number }) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const beginGame = () => {
    if (!gameId) {
      console.error("No game ID provided");
      return;
    }

    // Check if deadline has passed
    if (gameState?.lobbyDeadline) {
      const currentTime = Math.floor(Date.now() / 1000);
      const deadline = Number(gameState.lobbyDeadline);
      
      if (currentTime < deadline) {
        const timeRemaining = deadline - currentTime;
        alert(`Cannot begin game yet. Please wait ${Math.ceil(timeRemaining)} more seconds.`);
        return;
      }
    }

    // Check if game is in LOBBY state
    if (gameState?.status !== undefined && gameState.status !== 0) {
      alert("Game is not in LOBBY state. Cannot begin game.");
      return;
    }

    writeContract({
      address: TRADING_CARD_GAME_CONTRACT.address,
      abi: TRADING_CARD_GAME_CONTRACT.abi,
      functionName: "startGame",
      args: [gameId, false], // Default to insecure randomness
      chainId: CELO_SEPOLIA_CHAIN_ID,
    });
  };

  return {
    beginGame,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to generate cards for a game
 * @param gameId The game ID
 * @param useSecureRandomness If true, uses secure randomness (placeholder for Pyth). Defaults to false.
 */
export function useGenerateCards(
  gameId: bigint | undefined,
  useSecureRandomness: boolean = false
) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const generateCards = () => {
    if (!gameId) return;
    writeContract({
      address: TRADING_CARD_GAME_CONTRACT.address,
      abi: TRADING_CARD_GAME_CONTRACT.abi,
      functionName: "generateCards",
      args: [gameId, useSecureRandomness],
      chainId: CELO_SEPOLIA_CHAIN_ID,
    });
  };

  return {
    generateCards,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to commit player choices
 */
export function useCommitChoices(gameId: bigint | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const commitChoices = (cardNumbers: [bigint, bigint, bigint]) => {
    if (!gameId) return;
    writeContract({
      address: TRADING_CARD_GAME_CONTRACT.address,
      abi: TRADING_CARD_GAME_CONTRACT.abi,
      functionName: "commitChoices",
      args: [gameId, cardNumbers],
      chainId: CELO_SEPOLIA_CHAIN_ID,
    });
  };

  return {
    commitChoices,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to end a game (calculate final scores)
 * @param gameId The game ID
 */
export function useEndGame(gameId: bigint | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const endGame = () => {
    if (!gameId) return;
    writeContract({
      address: TRADING_CARD_GAME_CONTRACT.address,
      abi: TRADING_CARD_GAME_CONTRACT.abi,
      functionName: "endGame",
      args: [gameId],
      chainId: CELO_SEPOLIA_CHAIN_ID,
    });
  };

  return {
    endGame,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to check if page is visible (to pause polling when tab is hidden)
 */
function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * Hook to read game state
 * Uses the consolidated API endpoint to reduce RPC calls
 */
export function useGameState(gameId: bigint | undefined) {
  const isPageVisible = usePageVisibility();
  const [gameState, setGameState] = useState<GameState | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchGameState = useCallback(async () => {
    if (!gameId || !isPageVisible) {
      setGameState(undefined);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = new URL('/api/game-state', typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      url.searchParams.set('gameId', gameId.toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch game state: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.gameState) {
        setGameState({
          status: data.gameState.status as GameStatus,
          startTime: BigInt(data.gameState.startTime),
          lobbyDeadline: BigInt(data.gameState.lobbyDeadline),
          choiceDeadline: BigInt(data.gameState.choiceDeadline),
          resolutionDeadline: BigInt(data.gameState.resolutionDeadline),
          playerCount: BigInt(data.gameState.playerCount),
          cardCount: BigInt(data.gameState.cardCount),
        });
      } else {
        setGameState(undefined);
      }
    } catch (err) {
      console.error('Failed to fetch game state:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [gameId, isPageVisible]);

  useEffect(() => {
    if (!gameId || !isPageVisible) {
      return;
    }

    fetchGameState();

    const interval = setInterval(() => {
      if (isPageVisible) {
        fetchGameState();
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [gameId, isPageVisible, fetchGameState]);

  return {
    gameState,
    isLoading,
    error,
    refetch: fetchGameState,
  };
}

/**
 * Hook to read game players
 */
export function useGamePlayers(gameId: bigint | undefined) {
  const isPageVisible = usePageVisibility();
  const { data, isLoading, error } = useReadContract({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    functionName: "getGamePlayers",
    args: gameId ? [gameId] : undefined,
    chainId: CELO_SEPOLIA_CHAIN_ID,
    query: {
      enabled: !!gameId && isPageVisible,
      refetchInterval: isPageVisible ? 20000 : false,
    },
  });

  return {
    players: data as readonly `0x${string}`[] | undefined,
    isLoading,
    error,
  };
}

/**
 * Hook to read game cards
 */
export function useGameCards(gameId: bigint | undefined) {
  const isPageVisible = usePageVisibility();
  const { data, isLoading, error } = useReadContract({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    functionName: "getGameCards",
    args: gameId ? [gameId] : undefined,
    chainId: CELO_SEPOLIA_CHAIN_ID,
    query: {
      enabled: !!gameId && isPageVisible,
      refetchInterval: isPageVisible ? 20000 : false,
    },
  });

  return {
    cards: data as readonly bigint[] | undefined,
    isLoading,
    error,
  };
}

/**
 * Hook to read player choices
 */
export function usePlayerChoices(gameId: bigint | undefined, playerAddress: `0x${string}` | undefined) {
  const isPageVisible = usePageVisibility();
  const { data, isLoading, error } = useReadContract({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    functionName: "getPlayerChoices",
    args: gameId && playerAddress ? [gameId, playerAddress] : undefined,
    chainId: CELO_SEPOLIA_CHAIN_ID,
    query: {
      enabled: !!gameId && !!playerAddress && isPageVisible,
      refetchInterval: isPageVisible ? 20000 : false,
    },
  });

  const choice: PlayerChoice | undefined = data
    ? {
        selectedCards: data[0] as readonly [bigint, bigint, bigint],
        committedAt: data[1],
        committed: data[2],
      }
    : undefined;

  return {
    choice,
    isLoading,
    error,
  };
}

/**
 * Hook to read next game ID
 */
export function useNextGameId() {
  const isPageVisible = usePageVisibility();
  const { data, isLoading, error } = useReadContract({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    functionName: "getNextGameId",
    chainId: CELO_SEPOLIA_CHAIN_ID,
    query: {
      enabled: isPageVisible,
      refetchInterval: isPageVisible ? 10000 : false, // Poll every 10 seconds
    },
  });

  return {
    nextGameId: data as bigint | undefined,
    isLoading,
    error,
  };
}

/**
 * Hook to read prediction result
 */
export function usePredictionResult(gameId: bigint | undefined, cardNumber: bigint | undefined) {
  const { data, isLoading, error } = useReadContract({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    functionName: "getPredictionResult",
    args: gameId && cardNumber !== undefined ? [gameId, cardNumber] : undefined,
    chainId: CELO_SEPOLIA_CHAIN_ID,
    query: {
      enabled: !!gameId && cardNumber !== undefined,
    },
  });

  const result: PredictionResult | undefined = data
    ? {
        correct: data[0],
        pointsEarned: data[1],
      }
    : undefined;

  return {
    result,
    isLoading,
    error,
  };
}

/**
 * Hook to read player score
 */
export function usePlayerScore(playerAddress: `0x${string}` | undefined) {
  const { data, isLoading, error } = useReadContract({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    functionName: "getPlayerScore",
    args: playerAddress ? [playerAddress] : undefined,
    chainId: CELO_SEPOLIA_CHAIN_ID,
    query: {
      enabled: !!playerAddress,
    },
  });

  const score: PlayerScore | undefined = data
    ? {
        totalPoints: data[0],
        gamesPlayed: data[1],
        gamesWon: data[2],
      }
    : undefined;

  return {
    score,
    isLoading,
    error,
  };
}

/**
 * Hook to watch game events
 */
export function useGameEvents(gameId: bigint | undefined, onEvent?: (eventName: string, data: any) => void) {
  // Only watch events if contract is deployed and gameId is valid
  const isEnabled = gameId !== undefined;

  useWatchContractEvent({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    eventName: "GameStarted",
    chainId: CELO_SEPOLIA_CHAIN_ID,
    enabled: isEnabled,
    onLogs: (logs: any[]) => {
      const relevantLogs = logs.filter((log: any) => {
        const eventGameId = log.args?.gameId;
        return eventGameId === gameId;
      });
      if (relevantLogs.length > 0 && onEvent && relevantLogs[0]?.args) {
        onEvent("GameStarted", relevantLogs[0].args);
      }
    },
  });

  useWatchContractEvent({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    eventName: "PlayerJoined",
    chainId: CELO_SEPOLIA_CHAIN_ID,
    enabled: isEnabled,
    onLogs: (logs: any[]) => {
      const relevantLogs = logs.filter((log: any) => {
        const eventGameId = log.args?.gameId;
        return eventGameId === gameId;
      });
      if (relevantLogs.length > 0 && onEvent && relevantLogs[0]?.args) {
        onEvent("PlayerJoined", relevantLogs[0].args);
      }
    },
  });

  useWatchContractEvent({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    eventName: "GameActive",
    chainId: CELO_SEPOLIA_CHAIN_ID,
    enabled: isEnabled,
    onLogs: (logs: any[]) => {
      const relevantLogs = logs.filter((log: any) => {
        const eventGameId = log.args?.gameId;
        return eventGameId === gameId;
      });
      if (relevantLogs.length > 0 && onEvent && relevantLogs[0]?.args) {
        onEvent("GameActive", relevantLogs[0].args);
      }
    },
  });

  useWatchContractEvent({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    eventName: "ChoicesCommitted",
    chainId: CELO_SEPOLIA_CHAIN_ID,
    enabled: isEnabled,
    onLogs: (logs: any[]) => {
      const relevantLogs = logs.filter((log: any) => {
        const eventGameId = log.args?.gameId;
        return eventGameId === gameId;
      });
      if (relevantLogs.length > 0 && onEvent && relevantLogs[0]?.args) {
        onEvent("ChoicesCommitted", relevantLogs[0].args);
      }
    },
  });

  useWatchContractEvent({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    eventName: "GameEnded",
    chainId: CELO_SEPOLIA_CHAIN_ID,
    enabled: isEnabled,
    onLogs: (logs: any[]) => {
      const relevantLogs = logs.filter((log: any) => {
        const eventGameId = log.args?.gameId;
        return eventGameId === gameId;
      });
      if (relevantLogs.length > 0 && onEvent && relevantLogs[0]?.args) {
        onEvent("GameEnded", relevantLogs[0].args);
      }
    },
  });
}

