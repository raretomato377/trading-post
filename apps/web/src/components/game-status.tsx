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
  } = useGameStateManager(gameId);

  if (isLoading || !gameState) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
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
    <div className={`w-full max-w-2xl mx-auto p-4 rounded-lg border-2 ${getStatusColor()}`}>
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
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="opacity-75">Players</p>
            <p className="text-lg font-semibold">{Number(gameState.playerCount)}</p>
          </div>
          <div>
            <p className="opacity-75">Cards Generated</p>
            <p className="text-lg font-semibold">{Number(gameState.cardCount)}</p>
          </div>
        </div>
      </div>

      {status === GameStatus.ENDED && (
        <div className="mt-4 pt-4 border-t border-current border-opacity-20">
          <p className="text-sm font-semibold">Game Complete</p>
          <p className="text-xs opacity-75">Check results to see your score!</p>
        </div>
      )}
    </div>
  );
}

