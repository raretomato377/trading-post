import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import {
  useStartGame,
  useEndGame,
  useTransitionToResolution,
  GameStatus,
  type GameState,
  type PlayerChoice,
} from "./use-trading-game";
import { POLLING_INTERVAL_MS } from "@/config/contracts";

export interface GameStateData {
  gameId: bigint | undefined;
  gameState: GameState | undefined;
  players: readonly `0x${string}`[] | undefined;
  cards: readonly bigint[] | undefined;
  playerChoice: PlayerChoice | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to manage game state with polling and real-time updates
 * Uses a single API endpoint to fetch all game data at once
 */
export function useGameStateManager(gameId: bigint | undefined) {
  const { address } = useAccount();
  const [gameState, setGameState] = useState<GameState | undefined>(undefined);
  const [players, setPlayers] = useState<readonly `0x${string}`[] | undefined>(undefined);
  const [cards, setCards] = useState<readonly bigint[] | undefined>(undefined);
  const [playerChoice, setPlayerChoice] = useState<PlayerChoice | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if this is the first load
  const [error, setError] = useState<Error | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(true);

  // Track page visibility to pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Fetch all game data from single endpoint
  const fetchGameData = useCallback(async () => {
    if (!gameId) {
      setGameState(undefined);
      setPlayers(undefined);
      setCards(undefined);
      setPlayerChoice(undefined);
      setIsInitialLoad(true); // Reset initial load flag when gameId is cleared
      return;
    }

    // Only show loading state if we don't have data yet (initial load)
    // During refreshes, keep showing existing data to prevent flickering
    const hasExistingData = gameState !== undefined;
    if (!hasExistingData) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Use relative URL - Next.js will handle the origin
      const url = new URL('/api/game-state', typeof window !== 'undefined' ? window.location.origin : '');
      url.searchParams.set('gameId', gameId.toString());
      if (address) {
        url.searchParams.set('playerAddress', address);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch game state: ${response.statusText}`);
      }

      const data = await response.json();

      // Transform API response to match expected types
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

      setPlayers(data.players as `0x${string}`[]);
      setCards(data.cards?.map((c: string) => BigInt(c)) || []);
      
      if (data.playerChoice) {
        const selectedCards = data.playerChoice.selectedCards.map((c: string) => BigInt(c));
        setPlayerChoice({
          selectedCards: [selectedCards[0], selectedCards[1], selectedCards[2]] as [bigint, bigint, bigint],
          committedAt: BigInt(data.playerChoice.committedAt),
          committed: data.playerChoice.committed,
        });
      } else {
        setPlayerChoice(undefined);
      }
      
      // Mark initial load as complete once we have data
      if (isInitialLoad && data.gameState) {
        setIsInitialLoad(false);
      }
    } catch (err) {
      console.error('Failed to fetch game data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Only mark initial load as complete on error if we have existing data
      if (isInitialLoad && gameState) {
        setIsInitialLoad(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [gameId, address, gameState, isInitialLoad]);

  // Reset initial load flag when gameId changes
  useEffect(() => {
    if (gameId) {
      setIsInitialLoad(true);
    }
  }, [gameId]);

  // Poll the API endpoint
  // Note: We use a slightly longer interval here to avoid duplicate polling with useGameState
  // This hook is used by CardGame component, while useGameState is used by page.tsx
  const POLLING_INTERVAL_MULTIPLIER = 2; // Poll at 2x the base interval to reduce overlap
  useEffect(() => {
    if (!gameId || !isPageVisible) {
      return;
    }

    // Fetch immediately
    fetchGameData();

    // Poll at configured interval (multiplied to reduce overlap with other polling)
    const interval = setInterval(() => {
      if (isPageVisible) {
        fetchGameData();
      }
    }, POLLING_INTERVAL_MS * POLLING_INTERVAL_MULTIPLIER);

    return () => clearInterval(interval);
  }, [gameId, isPageVisible, fetchGameData]);

  // Calculate time remaining for each phase
  const getTimeRemaining = useCallback((deadline: bigint): number => {
    const now = Math.floor(Date.now() / 1000);
    const deadlineNum = Number(deadline);
    const remaining = deadlineNum - now;
    
    return Math.max(0, remaining);
  }, []);

  const lobbyTimeRemaining = gameState?.lobbyDeadline
    ? getTimeRemaining(gameState.lobbyDeadline)
    : 0;
  const choiceTimeRemaining = gameState?.choiceDeadline
    ? getTimeRemaining(gameState.choiceDeadline)
    : 0;
  const resolutionTimeRemaining = gameState?.resolutionDeadline
    ? getTimeRemaining(gameState.resolutionDeadline)
    : 0;

  // Log resolution timer for debugging
  useEffect(() => {
    if (gameState?.status === GameStatus.RESOLUTION) {
      const currentTime = Math.floor(Date.now() / 1000);
      const deadlineNum = gameState.resolutionDeadline ? Number(gameState.resolutionDeadline) : 0;
      console.log('🎮 [useGameStateManager] Resolution phase timer:', {
        resolutionDeadline: gameState.resolutionDeadline?.toString(),
        resolutionDeadlineNum: deadlineNum,
        currentTime,
        timeDiff: deadlineNum - currentTime,
        resolutionTimeRemaining,
        resolutionTimeRemainingMinutes: Math.floor(resolutionTimeRemaining / 60),
        resolutionTimeRemainingSeconds: resolutionTimeRemaining % 60,
        isZero: resolutionTimeRemaining === 0,
        deadlineIsZero: gameState.resolutionDeadline === 0n || deadlineNum === 0,
      });
    }
  }, [gameState?.status, gameState?.resolutionDeadline, resolutionTimeRemaining]);

  // Check if player is in the game
  const isPlayerInGame = players?.some((p) => p.toLowerCase() === address?.toLowerCase()) ?? false;

  // Check if player has committed choices
  const hasCommitted = playerChoice?.committed ?? false;

  // Auto-start game logic: automatically call startGame when lobby deadline passes
  const { startGame, isPending: isStartingGame, isSuccess: startSuccess } = useStartGame(gameId);
  const hasAttemptedStartRef = useRef(false);
  const startSuccessRef = useRef(false);

  useEffect(() => {
    // Track successful start - once successful, never try again for this game
    if (startSuccess) {
      startSuccessRef.current = true;
      hasAttemptedStartRef.current = true;
      return; // Exit early if already succeeded
    }

    // If transaction is already pending (from any instance), don't try again
    if (isStartingGame) {
      hasAttemptedStartRef.current = true; // Mark as attempted while pending
      return;
    }

    // If game is no longer in LOBBY, we don't need to start it
    if (gameState?.status !== GameStatus.LOBBY) {
      // Reset refs only if game ended or doesn't exist (for next game)
      if (gameState?.status === GameStatus.ENDED || !gameState) {
        hasAttemptedStartRef.current = false;
        startSuccessRef.current = false;
      }
      return;
    }

    // Only attempt to start game if:
    // 1. Wallet is connected (required for transaction)
    // 2. Game is in LOBBY state (already checked above)
    // 3. Lobby deadline has passed
    // 4. We haven't already attempted to start it
    // 5. Start hasn't already succeeded
    if (
      address && // Wallet must be connected
      gameState.lobbyDeadline &&
      lobbyTimeRemaining <= 0 &&
      !hasAttemptedStartRef.current &&
      !startSuccessRef.current
    ) {
      hasAttemptedStartRef.current = true;
      console.log(`🎮 Auto-starting game ${gameId} - lobby deadline passed`);
      // This will trigger a wallet popup for approval, but it's automatic
      startGame(false); // Use insecure randomness by default
    }
  }, [address, gameState?.status, gameState?.lobbyDeadline, lobbyTimeRemaining, gameId, startGame, isStartingGame, startSuccess]);

  // Auto-transition from CHOICE to RESOLUTION when choice deadline passes
  const { transitionToResolution, isPending: isTransitioning, isSuccess: transitionSuccess } = useTransitionToResolution(gameId);
  const hasAttemptedTransitionRef = useRef(false);
  const transitionSuccessRef = useRef(false);

  useEffect(() => {
    // Only attempt to transition if:
    // 1. Wallet is connected (required for transaction)
    // 2. Game is in CHOICE state
    // 3. Choice deadline has passed
    // 4. We haven't already attempted to transition
    // 5. We're not currently transitioning
    // 6. Transition hasn't already succeeded
    if (
      address &&
      gameState?.status === GameStatus.CHOICE &&
      gameState.choiceDeadline &&
      choiceTimeRemaining <= 0 &&
      !hasAttemptedTransitionRef.current &&
      !isTransitioning &&
      !transitionSuccessRef.current
    ) {
      hasAttemptedTransitionRef.current = true;
      console.log(`🎮 Auto-transitioning game ${gameId} to RESOLUTION - choice deadline passed`);
      transitionToResolution();
    }

    // Track successful transition
    if (transitionSuccess && !transitionSuccessRef.current) {
      transitionSuccessRef.current = true;
      // Refetch game state after successful transition
      setTimeout(() => {
        fetchGameData();
      }, 2000); // Wait 2 seconds for transaction to be indexed
    }

    // Reset the refs if game state changes (e.g., game actually transitioned or reset)
    if (gameState?.status === GameStatus.RESOLUTION || gameState?.status === GameStatus.ENDED) {
      // Transition succeeded, keep refs set to prevent re-triggering
      if (gameState?.status === GameStatus.RESOLUTION) {
        hasAttemptedTransitionRef.current = true;
        transitionSuccessRef.current = true;
      }
    } else if (gameState?.status === GameStatus.CHOICE && transitionSuccessRef.current) {
      // Game went back to CHOICE (shouldn't happen, but reset if it does)
      hasAttemptedTransitionRef.current = false;
      transitionSuccessRef.current = false;
    }
  }, [address, gameState?.status, gameState?.choiceDeadline, choiceTimeRemaining, gameId, transitionToResolution, isTransitioning, transitionSuccess, fetchGameData]);

  // Auto-end game logic: automatically call endGame when resolution deadline passes
  // The first user to encounter the expired deadline will trigger the endGame transaction
  const { endGame, isPending: isEndingGame } = useEndGame(gameId);
  const hasAttemptedEndRef = useRef(false);

  useEffect(() => {
    // Only attempt to end game if:
    // 1. Wallet is connected (required for transaction)
    // 2. Game is in RESOLUTION state
    // 3. Resolution deadline has passed (resolutionTimeRemaining <= 0)
    // 4. We haven't already attempted to end it
    // 5. We're not currently ending it
    if (
      address && // Wallet must be connected
      gameState?.status === GameStatus.RESOLUTION &&
      gameState.resolutionDeadline &&
      resolutionTimeRemaining <= 0 && // Deadline has passed
      !hasAttemptedEndRef.current &&
      !isEndingGame
    ) {
      hasAttemptedEndRef.current = true;
      console.log(`🎮 Auto-ending game ${gameId} - resolution deadline passed`);
      // This will trigger a wallet popup for approval, but it's automatic
      // Only the first user to see the expired deadline will trigger this
      endGame();
    }

    // Reset the ref if game state changes (e.g., game actually ended)
    if (gameState?.status === GameStatus.ENDED) {
      hasAttemptedEndRef.current = false;
    }
  }, [address, gameState?.status, gameState?.resolutionDeadline, resolutionTimeRemaining, gameId, endGame, isEndingGame]);

  // Refetch all data
  const refetch = useCallback(() => {
    fetchGameData();
  }, [fetchGameData]);

  return {
    gameId,
    gameState,
    players,
    cards,
    playerChoice,
    isLoading,
    error,
    lobbyTimeRemaining,
    choiceTimeRemaining,
    resolutionTimeRemaining,
    isPlayerInGame,
    hasCommitted,
    refetch,
  };
}

/**
 * Format time remaining as MM:SS
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get status label for game status
 */
export function getStatusLabel(status: GameStatus): string {
  switch (status) {
    case GameStatus.LOBBY:
      return "Lobby";
    case GameStatus.ACTIVE:
      return "Active";
    case GameStatus.CHOICE:
      return "Choice Phase";
    case GameStatus.RESOLUTION:
      return "Resolution";
    case GameStatus.ENDED:
      return "Ended";
    default:
      return "Unknown";
  }
}

