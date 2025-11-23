import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import {
  useEndGame,
  useStartGame,
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
 * @param gameId The game ID to fetch state for
 * @param disablePolling If true, only fetches once and doesn't poll
 */
export function useGameStateManager(gameId: bigint | undefined, disablePolling: boolean = false) {
  const { address } = useAccount();
  
  // Normalize gameId to bigint if it's a string or number
  const normalizedGameId = gameId 
    ? (typeof gameId === 'bigint' ? gameId : BigInt(String(gameId)))
    : undefined;
  
  // Log gameId normalization
  useEffect(() => {
    if (gameId !== normalizedGameId) {
      console.log('🎮 [useGameStateManager] Normalized gameId:', {
        original: gameId?.toString(),
        originalType: typeof gameId,
        normalized: normalizedGameId?.toString(),
        normalizedType: typeof normalizedGameId,
      });
    }
  }, [gameId, normalizedGameId]);
  
  const [gameState, setGameState] = useState<GameState | undefined>(undefined);
  const [players, setPlayers] = useState<readonly `0x${string}`[] | undefined>(undefined);
  const [cards, setCards] = useState<readonly bigint[] | undefined>(undefined);
  const [playerChoice, setPlayerChoice] = useState<PlayerChoice | undefined>(undefined);
  const [lastKnownPlayerChoice, setLastKnownPlayerChoice] = useState<PlayerChoice | undefined>(undefined); // Track last known playerChoice to prevent flickering
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
    if (!normalizedGameId || normalizedGameId === 0n) {
      console.log('🎮 [useGameStateManager] No gameId, clearing state');
      setGameState(undefined);
      setPlayers(undefined);
      setCards(undefined);
      setPlayerChoice(undefined);
      setIsInitialLoad(true); // Reset initial load flag when gameId is cleared
      return;
    }
    
    console.log('🎮 [useGameStateManager] Fetching game data for gameId:', normalizedGameId.toString());

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
      url.searchParams.set('gameId', normalizedGameId.toString());
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
        const newPlayerChoice = {
          selectedCards: [selectedCards[0], selectedCards[1], selectedCards[2]] as [bigint, bigint, bigint],
          committedAt: BigInt(data.playerChoice.committedAt),
          committed: data.playerChoice.committed,
        };
        setPlayerChoice(newPlayerChoice);
        // Update last known playerChoice if we have new data
        setLastKnownPlayerChoice(newPlayerChoice);
      } else {
        // Only clear playerChoice if we truly have no gameId (game ended or left)
        // Otherwise, keep the last known playerChoice to prevent flickering
        if (!normalizedGameId || normalizedGameId === 0n) {
          setPlayerChoice(undefined);
          setLastKnownPlayerChoice(undefined);
        }
        // If we still have a gameId but no playerChoice in response, keep last known
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
  }, [normalizedGameId, address]); // Removed gameState and isInitialLoad from deps to prevent polling restart

  // Reset initial load flag when gameId changes
  useEffect(() => {
    if (normalizedGameId) {
      setIsInitialLoad(true);
    }
  }, [normalizedGameId]);

  // Poll the API endpoint (or fetch once if polling is disabled)
  useEffect(() => {
    if (!normalizedGameId || !isPageVisible) {
      return;
    }

    // Fetch immediately
    fetchGameData();

    // If polling is disabled, only fetch once
    if (disablePolling) {
      return;
    }

    // Poll at configured interval
    const interval = setInterval(() => {
      if (isPageVisible) {
        fetchGameData();
      }
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [normalizedGameId, isPageVisible, fetchGameData, disablePolling]);

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

  // Use current playerChoice if available, otherwise fall back to lastKnownPlayerChoice to prevent flickering
  const effectivePlayerChoice = playerChoice || lastKnownPlayerChoice;

  // Check if player has committed choices (use effective playerChoice to prevent flickering)
  const hasCommitted = effectivePlayerChoice?.committed ?? false;

  // Start game logic - users manually call startGame when lobby deadline passes
  const { startGame, isPending: isStartingGame } = useStartGame(normalizedGameId, false);
  
  // Manual function to start game (called by user when lobby deadline passes)
  const manualStartGame = useCallback(() => {
    if (!normalizedGameId) return;
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }
    startGame(false);
  }, [normalizedGameId, address, startGame]);

  // End game logic - users manually call endGame when resolution deadline passes
  const { endGame, isPending: isEndingGame } = useEndGame(normalizedGameId);
  
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

  // Show start game button when lobby deadline has passed but cards haven't been generated
  // Only show if we're actually in LOBBY status (not RESOLUTION or ENDED)
  const showStartGameButton = 
    address &&
    gameState?.status === GameStatus.LOBBY &&
    gameState.lobbyDeadline &&
    gameState.lobbyDeadline > 0n &&
    lobbyTimeRemaining <= 0 &&
    (!cards || cards.length === 0) && // Cards not generated yet
    !isStartingGame;

  // Show end game button when resolution deadline has passed
  const showEndGameButton = 
    address &&
    gameState?.status === GameStatus.RESOLUTION &&
    gameState.resolutionDeadline &&
    gameState.resolutionDeadline > 0n && // Ensure deadline is set
    resolutionTimeRemaining <= 0 &&
    !isEndingGame;
  
  // Debug logging for end game button
  useEffect(() => {
    if (gameState?.status === GameStatus.RESOLUTION) {
      console.log('🎮 [useGameStateManager] End game button check:', {
        address: !!address,
        status: gameState.status,
        resolutionDeadline: gameState.resolutionDeadline?.toString(),
        resolutionDeadlineIsZero: gameState.resolutionDeadline === 0n,
        resolutionTimeRemaining,
        isEndingGame,
        showEndGameButton,
      });
    }
  }, [address, gameState?.status, gameState?.resolutionDeadline, resolutionTimeRemaining, isEndingGame, showEndGameButton]);

  return {
    gameId: normalizedGameId,
    gameState,
    players,
    cards,
    playerChoice: effectivePlayerChoice, // Use effective playerChoice to prevent flickering
    isLoading,
    error,
    lobbyTimeRemaining,
    choiceTimeRemaining,
    resolutionTimeRemaining,
    isPlayerInGame,
    hasCommitted,
    refetch,
    // Manual function to start game
    manualStartGame,
    // Flag for showing start game button
    showStartGameButton,
    // Loading state for starting game
    isStartingGame,
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

