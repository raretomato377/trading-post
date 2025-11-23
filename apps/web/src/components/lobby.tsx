"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useCreateGame, useJoinGame, useGameState, GameStatus, useNextGameId } from "@/hooks/use-trading-game";
import { formatTimeRemaining } from "@/hooks/use-game-state";

interface LobbyProps {
  currentGameId?: bigint;
  onGameJoined?: (gameId: bigint) => void;
  onGameStarted?: (gameId: bigint) => void;
}

export function Lobby({ currentGameId, onGameJoined, onGameStarted }: LobbyProps) {
  const { address, isConnected } = useAccount();
  const { createGame, isPending: isCreating, isSuccess: createSuccess, hash, error: createError, receipt } = useCreateGame();
  const { joinGame, isPending: isJoining } = useJoinGame(currentGameId);
  const { gameState, isLoading } = useGameState(currentGameId);
  const { nextGameId } = useNextGameId();

  const [localGameId, setLocalGameId] = useState<bigint | undefined>(currentGameId);
  const [createdGameId, setCreatedGameId] = useState<bigint | undefined>(undefined);

  // Log all state changes
  useEffect(() => {
    console.log('🎮 [Lobby] State update:', {
      currentGameId: currentGameId?.toString(),
      localGameId: localGameId?.toString(),
      createdGameId: createdGameId?.toString(),
      isConnected,
      address,
      isCreating,
      createSuccess,
      hash,
      createError: createError?.message,
      nextGameId: nextGameId?.toString(),
    });
  }, [currentGameId, localGameId, createdGameId, isConnected, address, isCreating, createSuccess, hash, createError, nextGameId]);

  // Try to get game ID after creation
  useEffect(() => {
    if (createSuccess && nextGameId) {
      // The new game ID should be nextGameId - 1 (since nextGameId increments after creation)
      const newGameId = nextGameId - 1n;
      console.log('🎮 [Lobby] Game created! New game ID:', newGameId.toString());
      console.log('🎮 [Lobby] Next game ID:', nextGameId.toString());
      
      if (!createdGameId || createdGameId !== newGameId) {
        setCreatedGameId(newGameId);
        setLocalGameId(newGameId);
        if (onGameStarted) {
          onGameStarted(newGameId);
        }
      }
    }
  }, [createSuccess, nextGameId, createdGameId, onGameStarted]);

  const handleCreateGame = () => {
    console.log('🎮 [Lobby] handleCreateGame called');
    console.log('🎮 [Lobby] isConnected:', isConnected);
    console.log('🎮 [Lobby] address:', address);
    
    if (!isConnected) {
      console.warn('🎮 [Lobby] Wallet not connected');
      alert("Please connect your wallet first");
      return;
    }
    
    console.log('🎮 [Lobby] Calling createGame()...');
    createGame();
  };

  const handleJoinGame = () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }
    if (!currentGameId) {
      alert("No game available to join");
      return;
    }
    joinGame();
    if (onGameJoined) {
      onGameJoined(currentGameId);
    }
  };

  // If there's a current game in LOBBY state, show join option
  const canJoin = currentGameId && gameState?.status === GameStatus.LOBBY;

  // Calculate time remaining
  const timeRemaining = gameState?.lobbyDeadline
    ? formatTimeRemaining(
        Math.max(0, Number(gameState.lobbyDeadline) - Math.floor(Date.now() / 1000))
      )
    : "00:00";

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Game Lobby</h2>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading game state...</p>
        </div>
      ) : canJoin ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Game Available</h3>
            <p className="text-sm text-blue-700 mb-4">
              A game is in the lobby. Join now to participate!
            </p>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">Time remaining:</p>
                <p className="text-2xl font-bold text-blue-600">{timeRemaining}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Players:</p>
                <p className="text-2xl font-bold text-blue-600">{Number(gameState?.playerCount || 0n)}</p>
              </div>
            </div>
            <button
              onClick={handleJoinGame}
              disabled={isJoining || !isConnected}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {isJoining ? "Joining..." : "Join Game"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Create New Game</h3>
            <p className="text-sm text-gray-600 mb-4">
              Create a new game and wait for other players to join. The game can be started manually
              after the lobby deadline (60 seconds) or when 2+ players join.
            </p>
            <button
              onClick={handleCreateGame}
              disabled={isCreating || !isConnected}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {isCreating ? "Creating..." : "Create New Game"}
            </button>
            
            {/* Debug info */}
            {(isCreating || createSuccess || createError) && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-xs space-y-1">
                {isCreating && <p className="text-blue-600">⏳ Creating game...</p>}
                {hash && (
                  <p className="text-gray-600">
                    📝 TX: <a href={`https://celo-sepolia.blockscout.com/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{hash.slice(0, 10)}...</a>
                  </p>
                )}
                {createSuccess && (
                  <p className="text-green-600">✅ Game created! ID: {createdGameId?.toString() || 'loading...'}</p>
                )}
                {createError && (
                  <p className="text-red-600">❌ Error: {createError.message}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ Please connect your wallet to start or join a game.
          </p>
        </div>
      )}
    </div>
  );
}

