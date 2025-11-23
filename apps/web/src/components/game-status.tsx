"use client";

import { useEffect } from "react";
import { useGameStateManager, formatTimeRemaining, getStatusLabel } from "@/hooks/use-game-state";
import { GameStatus } from "@/hooks/use-trading-game";

interface GameStatusProps {
  gameId: bigint | undefined;
}

export function GameStatusDisplay({ gameId }: GameStatusProps) {
  // Debug: Log when component renders
  useEffect(() => {
    console.log('🎮 [GameStatusDisplay] Component rendered with gameId:', gameId?.toString(), 'type:', typeof gameId);
  }, [gameId]);

  const {
    gameState,
    players,
    cards,
    lobbyTimeRemaining,
    choiceTimeRemaining,
    resolutionTimeRemaining,
    isLoading,
    showStartGameButton,
    manualStartGame,
    isStartingGame,
    showEndGameButton,
    manualEndGame,
    isEndingGame,
  } = useGameStateManager(gameId);

  // Debug logging
  useEffect(() => {
    console.log('🎮 [GameStatusDisplay] State update:', {
      gameId: gameId?.toString(),
      hasGameState: !!gameState,
      status: gameState?.status,
      isLoading,
      resolutionDeadline: gameState?.resolutionDeadline?.toString(),
      resolutionTimeRemaining,
      showEndGameButton,
    });
    
    if (gameState?.status === GameStatus.RESOLUTION) {
      console.log('🎮 [GameStatusDisplay] Resolution phase:', {
        gameId: gameId?.toString(),
        status: gameState.status,
        resolutionDeadline: gameState.resolutionDeadline?.toString(),
        resolutionTimeRemaining,
        showEndGameButton,
        isEndingGame,
      });
    }
  }, [gameId, gameState?.status, gameState?.resolutionDeadline, resolutionTimeRemaining, showEndGameButton, isEndingGame, isLoading]);

  // Only show loading skeleton on initial load (when we have no data yet)
  // During refreshes, keep showing existing data to prevent flickering
  if (isLoading && !gameState) {
    // Skeleton loader that matches the actual content structure to prevent layout shift
    return (
      <div className="w-full max-w-2xl mx-auto p-4 rounded-lg border-2 bg-gray-100 border-gray-200 min-h-[140px]">
        <div className="animate-pulse">
          {/* Header section - matches actual header */}
          <div className="flex items-center justify-between mb-2">
            <div className="space-y-2">
              <div className="h-5 bg-gray-300 rounded w-32"></div>
              <div className="h-4 bg-gray-300 rounded w-24"></div>
            </div>
            <div className="text-right space-y-2">
              <div className="h-8 bg-gray-300 rounded w-24 ml-auto"></div>
              <div className="h-4 bg-gray-300 rounded w-32 ml-auto"></div>
            </div>
          </div>
          
          {/* Border section - matches actual border section */}
          <div className="mt-4 pt-4 border-t border-gray-300">
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 rounded w-16"></div>
              <div className="h-6 bg-gray-300 rounded w-8"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If we still don't have gameState after loading, show a loading message instead of returning null
  // This helps debug why the component might not be rendering
  if (!gameState) {
    console.warn('🎮 [GameStatusDisplay] No gameState available:', {
      gameId: gameId?.toString(),
      isLoading,
      hasGameId: !!gameId,
    });
    return (
      <div className="w-full max-w-2xl mx-auto p-4 rounded-lg border-2 bg-yellow-100 border-yellow-200 min-h-[140px]">
        <p className="text-sm text-yellow-800">Loading game state for Game ID: {gameId?.toString() || 'N/A'}</p>
        {isLoading && <p className="text-xs text-yellow-600 mt-2">Fetching...</p>}
      </div>
    );
  }

  const status = gameState.status;
  const statusLabel = getStatusLabel(status);

  // Get time remaining based on current phase
  let timeRemaining = 0;
  let phaseLabel = "";
  const isResolutionEnded = status === GameStatus.RESOLUTION && resolutionTimeRemaining <= 0;

  switch (status) {
    case GameStatus.LOBBY:
      timeRemaining = lobbyTimeRemaining;
      phaseLabel = "Lobby closes in";
      break;
    case GameStatus.CHOICE:
      timeRemaining = choiceTimeRemaining;
      phaseLabel = "Time to choose";
      break;
    case GameStatus.RESOLUTION:
      if (isResolutionEnded) {
        phaseLabel = "Waiting to end game";
        timeRemaining = 0;
      } else {
        timeRemaining = resolutionTimeRemaining;
        phaseLabel = "Resolution in";
      }
      break;
    default:
      phaseLabel = "";
  }

  // Status color based on phase
  const getStatusColor = () => {
    switch (status) {
      case GameStatus.LOBBY:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case GameStatus.CHOICE:
        return "bg-green-100 text-green-800 border-green-200";
      case GameStatus.RESOLUTION:
        return "bg-purple-100 text-purple-800 border-purple-200";
      case GameStatus.ENDED:
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className={`w-full max-w-2xl mx-auto p-4 rounded-lg border-2 min-h-[140px] ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold">Game Status</h3>
          <p className="text-sm opacity-75">Game ID: {gameId?.toString() || "N/A"}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{statusLabel}</p>
          {isResolutionEnded ? (
            <p className="text-sm opacity-75 text-yellow-700 font-semibold">
              ⏰ Ready to end
            </p>
          ) : timeRemaining > 0 ? (
            <p className="text-sm opacity-75">
              {phaseLabel}: {formatTimeRemaining(timeRemaining)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-current border-opacity-20">
        <div className="text-sm">
          <div>
            <p className="opacity-75">Players</p>
            <p className="text-lg font-semibold">{Number(gameState.playerCount)}</p>
          </div>
        </div>
      </div>

      {status === GameStatus.ENDED && (
        <div className="mt-4 pt-4 border-t border-current border-opacity-20">
          <p className="text-sm font-semibold">Game Complete</p>
          <p className="text-xs opacity-75">Check results to see your score!</p>
        </div>
      )}

      {/* Start game button - only show when lobby deadline has passed but cards not generated */}
      {showStartGameButton && (
        <div className="mt-4 pt-4 border-t border-current border-opacity-20">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            <p className="text-sm font-semibold text-blue-800 mb-1">⏰ Lobby Phase Complete</p>
            <p className="text-xs text-blue-700">The lobby deadline has passed. Click below to start the game and generate cards.</p>
          </div>
          <button
            onClick={manualStartGame}
            disabled={isStartingGame}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 text-sm shadow-lg hover:shadow-xl"
          >
            {isStartingGame ? "Starting Game..." : "🎮 Start Game & Generate Cards"}
          </button>
        </div>
      )}

      {/* End game button - only show when resolution deadline has passed */}
      {showEndGameButton && (
        <div className="mt-4 pt-4 border-t border-current border-opacity-20">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
            <p className="text-sm font-semibold text-yellow-800 mb-1">⏰ Resolution Phase Complete</p>
            <p className="text-xs text-yellow-700">The resolution deadline has passed. Click below to finalize scores and end the game.</p>
          </div>
          <button
            onClick={manualEndGame}
            disabled={isEndingGame}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 text-sm shadow-lg hover:shadow-xl"
          >
            {isEndingGame ? "Ending Game..." : "🎯 End Game & Finalize Scores"}
          </button>
        </div>
      )}
    </div>
  );
}

