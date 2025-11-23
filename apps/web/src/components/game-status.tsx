"use client";

import { useGameStateManager, formatTimeRemaining, getStatusLabel } from "@/hooks/use-game-state";
import { GameStatus } from "@/hooks/use-trading-game";

interface GameStatusProps {
  gameId: bigint | undefined;
}

export function GameStatusDisplay({ gameId }: GameStatusProps) {
  const {
    gameState,
    players,
    lobbyTimeRemaining,
    choiceTimeRemaining,
    resolutionTimeRemaining,
    isLoading,
    showEndGameButton,
    manualEndGame,
    isEndingGame,
  } = useGameStateManager(gameId);

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

  // If we still don't have gameState after loading, return null
  if (!gameState) {
    return null;
  }

  const status = gameState.status;
  const statusLabel = getStatusLabel(status);

  // Get time remaining based on current phase
  let timeRemaining = 0;
  let phaseLabel = "";

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
      timeRemaining = resolutionTimeRemaining;
      phaseLabel = "Resolution in";
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
          {timeRemaining > 0 && (
            <p className="text-sm opacity-75">
              {phaseLabel}: {formatTimeRemaining(timeRemaining)}
            </p>
          )}
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

      {/* End game button - only show when resolution deadline has passed */}
      {showEndGameButton && (
        <div className="mt-4 pt-4 border-t border-current border-opacity-20">
          <p className="text-sm mb-2 opacity-75">Resolution phase ended. Click to finalize scores:</p>
          <button
            onClick={manualEndGame}
            disabled={isEndingGame}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
          >
            {isEndingGame ? "Ending Game..." : "End Game"}
          </button>
        </div>
      )}
    </div>
  );
}

