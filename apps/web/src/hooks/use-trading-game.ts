import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { TRADING_CARD_GAME_CONTRACT, CELO_MAINNET_CHAIN_ID, POLLING_INTERVAL_MS } from "@/config/contracts";
import { parseAbiItem, decodeEventLog } from "viem";
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
  const { address, chainId } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });
  const { hasActiveGame, activeGameId, isChecking } = usePlayerActiveGame(address);

  const createGame = async () => {
    // Check if player is already in an active game
    if (hasActiveGame && activeGameId) {
      alert(`You are already in an active game (Game ID: ${activeGameId.toString()}). Please finish that game before creating a new one.`);
      return;
    }

    if (isChecking) {
      alert("Please wait while we check your current game status...");
      return;
    }
    
    console.log('🎮 [createGame] Starting createGame...');
    console.log('🎮 [createGame] Contract address:', TRADING_CARD_GAME_CONTRACT.address);
    console.log('🎮 [createGame] Expected Chain ID:', CELO_MAINNET_CHAIN_ID);
    console.log('🎮 [createGame] Current Chain ID:', chainId);
    console.log('🎮 [createGame] Wallet address:', address);
    
    // Note: We don't check chainId here because Wagmi will handle chain switching
    // when chainId is specified in writeContract. The Farcaster connector
    // may not support getChainId, so we rely on Wagmi's built-in chain switching.
    
    try {
      // Wagmi will automatically prompt for chain switch if needed when chainId is specified
      // Try to estimate gas first to get better error messages
      writeContract({
        address: TRADING_CARD_GAME_CONTRACT.address,
        abi: TRADING_CARD_GAME_CONTRACT.abi,
        functionName: "createGame",
        chainId: CELO_MAINNET_CHAIN_ID,
        // Don't specify gas - let Wagmi estimate it
        // If estimation fails, we'll get a better error message
      });
      console.log('🎮 [createGame] writeContract called successfully');
    } catch (err: any) {
      console.error('🎮 [createGame] Error calling writeContract:', err);
      
      // Provide more helpful error messages
      const errorMessage = err?.message || err?.shortMessage || String(err);
      console.error('🎮 [createGame] Error details:', {
        message: errorMessage,
        name: err?.name,
        cause: err?.cause,
        shortMessage: err?.shortMessage,
        details: err?.details,
        data: err?.data,
        code: err?.code,
      });
      
      // Check for specific error types
      if (errorMessage?.toLowerCase().includes('insufficient') || 
          errorMessage?.toLowerCase().includes('balance') ||
          errorMessage?.toLowerCase().includes('funds')) {
        console.error('🎮 [createGame] Insufficient balance error detected');
        console.error('🎮 [createGame] Current chain:', chainId);
        console.error('🎮 [createGame] Expected chain:', CELO_MAINNET_CHAIN_ID);
        console.error('🎮 [createGame] This might be due to:');
        console.error('  1. Wallet is on wrong network (not Celo Mainnet)');
        console.error('  2. Gas estimation failed (contract might be reverting)');
        console.error('  3. Actual insufficient CELO balance for gas');
        console.error('  4. RPC endpoint issues');
        console.error('  5. Contract not deployed at this address');
      }
      
      throw err;
    }
  };

  // Log transaction status changes
  useEffect(() => {
    if (hash) {
      console.log('🎮 [createGame] Transaction hash:', hash);
      console.log('🎮 [createGame] View on explorer:', `https://celoscan.io/tx/${hash}`);
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

  // Extract game ID from transaction receipt
  const [createdGameId, setCreatedGameId] = useState<bigint | undefined>(undefined);

  useEffect(() => {
    if (isSuccess && receipt) {
      console.log('🎮 [createGame] ✅ Transaction confirmed!');
      console.log('🎮 [createGame] Receipt:', receipt);
      
      // Try to extract game ID from GameStarted event
      if (receipt.logs && receipt.logs.length > 0) {
        try {
          // Parse the GameStarted event: event GameStarted(uint256 indexed gameId, address indexed starter)
          const gameStartedEvent = parseAbiItem('event GameStarted(uint256 indexed gameId, address indexed starter)');
          
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: [gameStartedEvent],
                data: log.data,
                topics: log.topics,
              });
              
              if (decoded.eventName === 'GameStarted' && decoded.args?.gameId) {
                const gameId = decoded.args.gameId as bigint;
                console.log('🎮 [createGame] Extracted game ID from event:', gameId.toString());
                setCreatedGameId(gameId);
                break;
              }
            } catch (err) {
              // Not the event we're looking for, continue
              continue;
            }
          }
        } catch (err) {
          console.warn('🎮 [createGame] Failed to parse events:', err);
        }
      }
    }
  }, [isSuccess, receipt]);

  useEffect(() => {
    if (error) {
      console.error('🎮 [createGame] ❌ Error:', error);
      console.error('🎮 [createGame] Error details:', {
        name: error?.name,
        message: error?.message,
        cause: (error as any)?.cause,
        shortMessage: (error as any)?.shortMessage,
        details: (error as any)?.details,
        data: (error as any)?.data,
        stack: (error as any)?.stack,
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
    createdGameId, // Game ID extracted from transaction receipt
  };
}

/**
 * Hook to join an existing game
 */
export function useJoinGame(gameId: bigint | undefined) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const { hasActiveGame, activeGameId, isChecking } = usePlayerActiveGame(address);

  const joinGame = async () => {
    // Check if player is already in an active game (and it's not the game they're trying to join)
    if (hasActiveGame && activeGameId && activeGameId !== gameId) {
      alert(`You are already in an active game (Game ID: ${activeGameId.toString()}). Please finish that game before joining another one.`);
      return;
    }

    if (isChecking) {
      alert("Please wait while we check your current game status...");
      return;
    }

    if (!gameId) return;
    
    // Wagmi will automatically prompt for chain switch if needed when chainId is specified
    writeContract({
      address: TRADING_CARD_GAME_CONTRACT.address,
      abi: TRADING_CARD_GAME_CONTRACT.abi,
      functionName: "joinGame",
      args: [gameId],
      chainId: CELO_MAINNET_CHAIN_ID,
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
 * Hook to start a game (can be called when lobby deadline passes)
 * @param gameId The game ID
 * @param useSecureRandomness If true, uses secure randomness. Defaults to false.
 */
export function useStartGame(gameId: bigint | undefined, useSecureRandomness: boolean = false) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const startGame = async (secureRandomness: boolean = useSecureRandomness) => {
    if (!gameId) {
      console.error("No game ID provided");
      return;
    }

    // Wagmi will automatically prompt for chain switch if needed when chainId is specified
    writeContract({
      address: TRADING_CARD_GAME_CONTRACT.address,
      abi: TRADING_CARD_GAME_CONTRACT.abi,
      functionName: "startGame",
      args: [gameId, secureRandomness],
      chainId: CELO_MAINNET_CHAIN_ID,
    });
  };

  return {
    startGame,
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
 * @deprecated Use useStartGame instead
 */
export function useBeginGame(gameId: bigint | undefined, gameState?: { lobbyDeadline?: bigint; status?: number }) {
  const { startGame, hash, isPending, isSuccess, error } = useStartGame(gameId);

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

    startGame(false);
  };

  return {
    beginGame,
    hash,
    isPending,
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
      chainId: CELO_MAINNET_CHAIN_ID,
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

  const commitChoices = async (cardNumbers: [bigint, bigint, bigint]) => {
    if (!gameId) {
      console.error('🎮 [commitChoices] No game ID provided');
      return;
    }

    console.log('🎮 [commitChoices] Starting commitChoices...');
    console.log('🎮 [commitChoices] Game ID:', gameId.toString());
    console.log('🎮 [commitChoices] Card numbers:', cardNumbers.map(n => n.toString()));

    try {
      // Wagmi will automatically prompt for chain switch if needed when chainId is specified
      writeContract({
        address: TRADING_CARD_GAME_CONTRACT.address,
        abi: TRADING_CARD_GAME_CONTRACT.abi,
        functionName: "commitChoices",
        args: [gameId, cardNumbers],
        chainId: CELO_MAINNET_CHAIN_ID,
      });
      console.log('🎮 [commitChoices] writeContract called successfully');
    } catch (err) {
      console.error('🎮 [commitChoices] Error calling writeContract:', err);
      throw err;
    }
  };

  // Log transaction status changes
  useEffect(() => {
    if (hash) {
      console.log('🎮 [commitChoices] Transaction hash:', hash);
      console.log('🎮 [commitChoices] View on explorer:', `https://celoscan.io/tx/${hash}`);
    }
  }, [hash]);

  useEffect(() => {
    if (isPending) {
      console.log('🎮 [commitChoices] Transaction pending...');
    }
  }, [isPending]);

  useEffect(() => {
    if (isConfirming) {
      console.log('🎮 [commitChoices] Waiting for confirmation...');
    }
  }, [isConfirming]);

  useEffect(() => {
    if (isSuccess) {
      console.log('🎮 [commitChoices] ✅ Transaction confirmed!');
    }
  }, [isSuccess]);

  useEffect(() => {
    if (error) {
      console.error('🎮 [commitChoices] ❌ Error:', error);
      console.error('🎮 [commitChoices] Error details:', {
        name: error?.name,
        message: error?.message,
      });
    }
  }, [error]);

  return {
    commitChoices,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
  };
}

/**
 * Hook to transition game from CHOICE to RESOLUTION when deadline passes
 * @param gameId The game ID
 */
export function useTransitionToResolution(gameId: bigint | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const transitionToResolution = async () => {
    if (!gameId) return;

    // Wagmi will automatically prompt for chain switch if needed when chainId is specified
    writeContract({
      address: TRADING_CARD_GAME_CONTRACT.address,
      abi: TRADING_CARD_GAME_CONTRACT.abi,
      functionName: "transitionToResolution",
      args: [gameId],
      chainId: CELO_MAINNET_CHAIN_ID,
    });
  };

  return {
    transitionToResolution,
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
      chainId: CELO_MAINNET_CHAIN_ID,
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
    }, POLLING_INTERVAL_MS);

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
    chainId: CELO_MAINNET_CHAIN_ID,
    query: {
      enabled: !!gameId && isPageVisible,
      refetchInterval: isPageVisible ? POLLING_INTERVAL_MS : false,
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
    chainId: CELO_MAINNET_CHAIN_ID,
    query: {
      enabled: !!gameId && isPageVisible,
      refetchInterval: isPageVisible ? POLLING_INTERVAL_MS : false,
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
    chainId: CELO_MAINNET_CHAIN_ID,
    query: {
      enabled: !!gameId && !!playerAddress && isPageVisible,
      refetchInterval: isPageVisible ? POLLING_INTERVAL_MS : false,
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
    chainId: CELO_MAINNET_CHAIN_ID,
    query: {
      enabled: isPageVisible,
      refetchInterval: isPageVisible ? POLLING_INTERVAL_MS : false,
    },
  });

  return {
    nextGameId: data as bigint | undefined,
    isLoading,
    error,
  };
}

/**
 * Hook to get the player's active game from the contract
 * Uses the contract's getPlayerActiveGame function for accurate tracking
 */
export function usePlayerActiveGame(playerAddress: `0x${string}` | undefined) {
  const isPageVisible = usePageVisibility();
  const { data, isLoading, error, refetch } = useReadContract({
    address: TRADING_CARD_GAME_CONTRACT.address,
    abi: TRADING_CARD_GAME_CONTRACT.abi,
    functionName: "getPlayerActiveGame",
    args: playerAddress ? [playerAddress] : undefined,
    chainId: CELO_MAINNET_CHAIN_ID,
    query: {
      enabled: !!playerAddress && isPageVisible,
      refetchInterval: isPageVisible ? POLLING_INTERVAL_MS : false,
      // Add retry configuration to prevent stuck loading states
      retry: 2,
      retryDelay: 1000,
    },
  });

  const activeGameId = data && data > 0n ? data as bigint : undefined;

  // If there's an error and we've been loading for too long, consider it done
  // This prevents the button from being stuck in "Checking..." forever
  const isChecking = isLoading && !error;

  return {
    activeGameId,
    isChecking,
    hasActiveGame: activeGameId !== undefined,
    error,
    refetch,
  };
}

/**
 * Hook to find available lobbies (games in LOBBY state that player can join)
 * Checks recent games (last 20 games) to find available lobbies
 */
export function useAvailableLobbies(playerAddress: `0x${string}` | undefined) {
  const { nextGameId } = useNextGameId();
  const [availableLobbies, setAvailableLobbies] = useState<Array<{ gameId: bigint; playerCount: number; timeRemaining: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!nextGameId || nextGameId === 1n) {
      setAvailableLobbies([]);
      setIsLoading(false); // Ensure loading is false when no games exist
      return;
    }

    setIsLoading(true);
    
    const findLobbies = async () => {
      try {
        const startGameId = nextGameId > 20n ? nextGameId - 20n : 1n;
        const endGameId = nextGameId - 1n;
        
        const lobbyPromises: Promise<{ gameId: bigint; playerCount: number; timeRemaining: number } | null>[] = [];
        
        for (let gameId = endGameId; gameId >= startGameId; gameId--) {
          lobbyPromises.push(
            fetch(`/api/game-state?gameId=${gameId}${playerAddress ? `&playerAddress=${playerAddress}` : ''}`)
              .then(async (response) => {
                if (!response.ok) return null;
                
                const gameData = await response.json();
                
                // Check if game is in LOBBY state
                if (gameData.gameState && Number(gameData.gameState.status) === 0) { // LOBBY = 0
                  const now = Math.floor(Date.now() / 1000);
                  const deadline = Number(gameData.gameState.lobbyDeadline);
                  const timeRemaining = Math.max(0, deadline - now);
                  
                  // Check if player is already in this game
                  const playerList = gameData.players || [];
                  const isInGame = playerAddress ? playerList.some((p: string) => 
                    p.toLowerCase() === playerAddress.toLowerCase()
                  ) : false;
                  
                  // Only include if player is not already in it and lobby is still open
                  if (!isInGame && timeRemaining > 0) {
                    return {
                      gameId,
                      playerCount: Number(gameData.gameState.playerCount),
                      timeRemaining,
                    };
                  }
                }
                return null;
              })
              .catch(() => null)
          );
        }
        
        const results = await Promise.all(lobbyPromises);
        const lobbies = results.filter((lobby): lobby is { gameId: bigint; playerCount: number; timeRemaining: number } => 
          lobby !== null
        );
        
        // Sort by newest first
        lobbies.sort((a, b) => Number(b.gameId - a.gameId));
        
        setAvailableLobbies(lobbies);
      } catch (err) {
        console.error('Error finding lobbies:', err);
        setAvailableLobbies([]); // Set empty array on error
      } finally {
        setIsLoading(false);
      }
    };

    findLobbies();
  }, [nextGameId, playerAddress]);

  return {
    availableLobbies,
    isLoading,
    hasAvailableLobbies: availableLobbies.length > 0,
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
    chainId: CELO_MAINNET_CHAIN_ID,
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
    chainId: CELO_MAINNET_CHAIN_ID,
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
    chainId: CELO_MAINNET_CHAIN_ID,
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
    chainId: CELO_MAINNET_CHAIN_ID,
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
    chainId: CELO_MAINNET_CHAIN_ID,
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
    chainId: CELO_MAINNET_CHAIN_ID,
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
    chainId: CELO_MAINNET_CHAIN_ID,
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

