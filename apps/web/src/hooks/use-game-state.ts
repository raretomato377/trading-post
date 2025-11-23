import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import {
  useEndGame,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, address]); // Removed gameState and isInitialLoad from deps to prevent polling restart

  // Reset initial load flag when gameId changes
  useEffect(() => {
    if (gameId) {
      setIsInitialLoad(true);
    }
  }, [gameId]);

  // Poll the API endpoint
  useEffect(() => {
    if (!gameId || !isPageVisible) {
      return;
    }

    // Fetch immediately
    fetchGameData();

    // Poll at configured interval
    const interval = setInterval(() => {
      if (isPageVisible) {
        fetchGameData();
      }
    }, POLLING_INTERVAL_MS);

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

  // Phases are now determined by timestamps automatically
  // No need for startGame or transitionToResolution - cards are generated lazily in commitChoices

  // End game logic - users manually call endGame when resolution deadline passes
  const { endGame, isPending: isEndingGame } = useEndGame(gameId);
  
  // Manual function to end game (called by user when resolution deadline passes)
  const manualEndGame = useCallback(() => {
    if (!gameId) return;
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }
    endGame();
  }, [gameId, address, endGame]);

  // Refetch all data
  const refetch = useCallback(() => {
    fetchGameData();
  }, [fetchGameData]);

  // Show end game button when resolution deadline has passed
  const showEndGameButton = 
    address &&
    gameState?.status === GameStatus.RESOLUTION &&
    gameState.resolutionDeadline &&
    resolutionTimeRemaining <= 0 &&
    !isEndingGame;

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
    // Manual function to end game
    manualEndGame,
    // Flag for showing end game button
    showEndGameButton,
    // Loading state
    isEndingGame,
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

