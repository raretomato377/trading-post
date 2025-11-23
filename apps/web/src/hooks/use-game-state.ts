import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import {
  useStartGame,
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
      return;
    }

    setIsLoading(true);
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
    } catch (err) {
      console.error('Failed to fetch game data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [gameId, address]);

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
    return Math.max(0, deadlineNum - now);
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

  // Check if player is in the game
  const isPlayerInGame = players?.some((p) => p.toLowerCase() === address?.toLowerCase()) ?? false;

  // Check if player has committed choices
  const hasCommitted = playerChoice?.committed ?? false;

  // Auto-start game logic: automatically call startGame when lobby deadline passes
  const { startGame, isPending: isStartingGame } = useStartGame(gameId);
  const hasAttemptedStartRef = useRef(false);

  useEffect(() => {
    // Only attempt to start game if:
    // 1. Wallet is connected (required for transaction)
    // 2. Game is in LOBBY state
    // 3. Lobby deadline has passed
    // 4. We haven't already attempted to start it
    // 5. We're not currently starting it
    if (
      address && // Wallet must be connected
      gameState?.status === GameStatus.LOBBY &&
      gameState.lobbyDeadline &&
      lobbyTimeRemaining <= 0 &&
      !hasAttemptedStartRef.current &&
      !isStartingGame
    ) {
      hasAttemptedStartRef.current = true;
      console.log(`🎮 Auto-starting game ${gameId} - lobby deadline passed`);
      // This will trigger a wallet popup for approval, but it's automatic
      startGame(false); // Use insecure randomness by default
    }

    // Reset the ref if game state changes (e.g., game actually started)
    if (gameState?.status !== GameStatus.LOBBY) {
      hasAttemptedStartRef.current = false;
    }
  }, [address, gameState?.status, gameState?.lobbyDeadline, lobbyTimeRemaining, gameId, startGame, isStartingGame]);

  // Auto-end game logic: automatically call endGame when resolution deadline passes
  // Note: This will require wallet approval (popup), but happens automatically for the first user to detect it
  const { endGame, isPending: isEndingGame } = useEndGame(gameId);
  const hasAttemptedEndRef = useRef(false);

  useEffect(() => {
    // Only attempt to end game if:
    // 1. Wallet is connected (required for transaction)
    // 2. Game is in RESOLUTION state
    // 3. Resolution deadline has passed
    // 4. We haven't already attempted to end it
    // 5. We're not currently ending it
    if (
      address && // Wallet must be connected
      gameState?.status === GameStatus.RESOLUTION &&
      gameState.resolutionDeadline &&
      resolutionTimeRemaining <= 0 &&
      !hasAttemptedEndRef.current &&
      !isEndingGame
    ) {
      hasAttemptedEndRef.current = true;
      console.log(`🎮 Auto-ending game ${gameId} - resolution deadline passed`);
      // This will trigger a wallet popup for approval, but it's automatic
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

