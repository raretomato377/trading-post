import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import {
  useGameState,
  useGamePlayers,
  useGameCards,
  usePlayerChoices,
  useEndGame,
  GameStatus,
  type GameState,
} from "./use-trading-game";

export interface GameStateData {
  gameId: bigint | undefined;
  gameState: GameState | undefined;
  players: readonly `0x${string}`[] | undefined;
  cards: readonly bigint[] | undefined;
  playerChoice: ReturnType<typeof usePlayerChoices>["choice"];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to manage game state with polling and real-time updates
 */
export function useGameStateManager(gameId: bigint | undefined) {
  const { address } = useAccount();
  const { gameState, isLoading: isLoadingState, error: stateError, refetch: refetchState } = useGameState(gameId);
  const { players, isLoading: isLoadingPlayers, error: playersError } = useGamePlayers(gameId);
  const { cards, isLoading: isLoadingCards, error: cardsError } = useGameCards(gameId);
  const { choice: playerChoice, isLoading: isLoadingChoice, error: choiceError } = usePlayerChoices(
    gameId,
    address
  );

  const isLoading = isLoadingState || isLoadingPlayers || isLoadingCards || isLoadingChoice;
  const error = stateError || playersError || cardsError || choiceError;

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
    refetchState();
  }, [refetchState]);

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

