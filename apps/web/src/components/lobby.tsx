"use client";

import { useState, useEffect } from "react";
import { useAccount, useSwitchChain, useBalance } from "wagmi";
import { useCreateGame, useJoinGame, useGameState, GameStatus, useNextGameId, usePlayerActiveGame, useAvailableLobbies } from "@/hooks/use-trading-game";
import { CELO_MAINNET_CHAIN_ID } from "@/config/contracts";
import { formatTimeRemaining } from "@/hooks/use-game-state";
import { formatUnits } from "viem";

interface LobbyProps {
  currentGameId?: bigint;
  onGameJoined?: (gameId: bigint) => void;
  onGameStarted?: (gameId: bigint) => void;
}

export function Lobby({ currentGameId, onGameJoined, onGameStarted }: LobbyProps) {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const { createGame, isPending: isCreating, isSuccess: createSuccess, hash, error: createError, receipt } = useCreateGame();
  const { nextGameId } = useNextGameId();
  const { hasActiveGame, activeGameId, isChecking: isCheckingActiveGame } = usePlayerActiveGame(address);
  const { availableLobbies, isLoading: isLoadingLobbies, hasAvailableLobbies } = useAvailableLobbies(address);
  
  // Check wallet balance
  const { data: balance, isLoading: isLoadingBalance } = useBalance({
    address,
    chainId: CELO_MAINNET_CHAIN_ID,
  });
  
  // Use the first available lobby if no currentGameId is set
  const lobbyToJoin = currentGameId || (availableLobbies.length > 0 ? availableLobbies[0].gameId : undefined);
  const { joinGame, isPending: isJoining } = useJoinGame(lobbyToJoin);
  
  const isWrongChain = isConnected && chainId !== CELO_MAINNET_CHAIN_ID;
  
  // Check if balance is too low (less than 0.001 CELO)
  const minBalance = BigInt("1000000000000000"); // 0.001 CELO in wei
  const hasLowBalance = balance && balance.value < minBalance;

  const handleSwitchChain = async () => {
    try {
      await switchChain({ chainId: CELO_MAINNET_CHAIN_ID });
    } catch (error) {
      console.error('Failed to switch chain:', error);
      alert('Failed to switch chain. Please manually switch to Celo Mainnet in your wallet settings.');
    }
  };

  const [localGameId, setLocalGameId] = useState<bigint | undefined>(currentGameId);
  const [createdGameId, setCreatedGameId] = useState<bigint | undefined>(undefined);
  
  // Sync localGameId with currentGameId prop when it changes from parent
  useEffect(() => {
    if (currentGameId && currentGameId !== localGameId) {
      console.log('🎮 [Lobby] Syncing localGameId with currentGameId:', currentGameId.toString());
      setLocalGameId(currentGameId);
    }
  }, [currentGameId, localGameId]);
  
  // Use localGameId or currentGameId for game state (prioritize localGameId if it exists)
  // This ensures we fetch the new game's state immediately after creation
  const gameIdForState = localGameId || currentGameId;
  const { gameState, isLoading, refetch } = useGameState(gameIdForState);

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
        // Immediately refetch game state for the new game
        setTimeout(() => {
          console.log('🎮 [Lobby] Refetching game state for new game:', newGameId.toString());
          refetch();
        }, 1000); // Wait 1 second for the transaction to be indexed
      }
    }
  }, [createSuccess, nextGameId, createdGameId, onGameStarted, refetch]);

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
    const gameIdToJoin = currentGameId || (availableLobbies.length > 0 ? availableLobbies[0].gameId : undefined);
    if (!gameIdToJoin) {
      alert("No game available to join");
      return;
    }
    joinGame();
    if (onGameJoined) {
      onGameJoined(gameIdToJoin);
    }
  };

  // If there's a current game in LOBBY state, show join option
  // Or if there are available lobbies, show join option
  const canJoin = (gameIdForState && gameState?.status === GameStatus.LOBBY) || hasAvailableLobbies;

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
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              {gameIdForState && gameState?.status === GameStatus.LOBBY 
                ? "Game Available" 
                : "Available Lobbies"}
            </h3>
            {gameIdForState && gameState?.status === GameStatus.LOBBY ? (
              <>
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
              </>
            ) : (
              <>
                <p className="text-sm text-blue-700 mb-4">
                  {availableLobbies.length} lobby{availableLobbies.length !== 1 ? 'ies' : 'y'} available to join!
                </p>
                {availableLobbies.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {availableLobbies.slice(0, 3).map((lobby) => (
                      <div key={lobby.gameId.toString()} className="flex items-center justify-between p-2 bg-white rounded">
                        <span className="text-sm text-gray-700">Game #{lobby.gameId.toString()}</span>
                        <span className="text-sm text-gray-600">{lobby.playerCount} player{lobby.playerCount !== 1 ? 's' : ''}</span>
                        <span className="text-sm text-gray-600">{formatTimeRemaining(lobby.timeRemaining)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <button
              onClick={handleJoinGame}
              disabled={isJoining || !isConnected || (hasActiveGame && activeGameId !== gameIdForState) || isCheckingActiveGame || isLoadingLobbies}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {isJoining ? "Joining..." : isCheckingActiveGame || isLoadingLobbies ? "Checking..." : (hasActiveGame && activeGameId !== gameIdForState) ? "Already in Another Game" : "Join Lobby"}
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
              disabled={isCreating || !isConnected || hasActiveGame || isCheckingActiveGame}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {isCreating ? "Creating..." : isCheckingActiveGame ? "Checking..." : hasActiveGame ? "Already in Game" : "Create New Game"}
            </button>
            
            {/* Debug info */}
            {(isCreating || createSuccess || createError) && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-xs space-y-1">
                {isCreating && <p className="text-blue-600">⏳ Creating game...</p>}
                {hash && (
                  <p className="text-gray-600">
                    📝 TX: <a href={`https://celoscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{hash.slice(0, 10)}...</a>
                  </p>
                )}
                {createSuccess && (
                  <p className="text-green-600">✅ Game created! ID: {createdGameId?.toString() || 'loading...'}</p>
                )}
                {createError && (
                  <div className="space-y-2">
                    <p className="text-red-600 font-semibold">❌ Error: {createError.message}</p>
                    {(createError.message?.toLowerCase().includes('insufficient') || 
                      createError.message?.toLowerCase().includes('balance') ||
                      createError.message?.toLowerCase().includes('funds')) && (
                      <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <p className="text-yellow-800 font-semibold mb-1">💡 Need CELO for Gas</p>
                        <p className="text-yellow-700 mb-2">
                          You need CELO in your wallet to pay for transaction fees. Get CELO from:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-yellow-700">
                          <li>
                            <a href="https://celo.org/developers/faucet" target="_blank" rel="noopener noreferrer" className="underline">
                              Celo Faucet (for testnet)
                            </a>
                          </li>
                          <li>
                            <a href="https://valoraapp.com/" target="_blank" rel="noopener noreferrer" className="underline">
                              Valora Wallet
                            </a>
                          </li>
                          <li>
                            <a href="https://www.coinbase.com/price/celo" target="_blank" rel="noopener noreferrer" className="underline">
                              Buy CELO on Coinbase
                            </a>
                          </li>
                        </ul>
                        <p className="text-yellow-600 mt-2 text-xs">
                          You only need a small amount (~0.001 CELO) for gas fees.
                        </p>
                      </div>
                    )}
                  </div>
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

      {hasActiveGame && activeGameId && activeGameId !== gameIdForState && (
        <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800 font-semibold mb-1">
            ⚠️ Already in Active Game
          </p>
          <p className="text-sm text-orange-700">
            You are already participating in Game ID: <strong>{activeGameId.toString()}</strong>. 
            Please finish that game before creating or joining a new one.
          </p>
        </div>
      )}

      {hasLowBalance && isConnected && !isLoadingBalance && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 font-semibold mb-2">
            ⚠️ Low Balance
          </p>
          <p className="text-sm text-yellow-700 mb-2">
            Your wallet balance is low. You need CELO to pay for transaction fees.
            {balance && (
              <span className="block mt-1">
                Current balance: {formatUnits(balance.value, balance.decimals)} {balance.symbol}
              </span>
            )}
          </p>
          <p className="text-xs text-yellow-600 mb-3">
            Get CELO from:{" "}
            <a href="https://valoraapp.com/" target="_blank" rel="noopener noreferrer" className="underline">
              Valora
            </a>
            {" | "}
            <a href="https://www.coinbase.com/price/celo" target="_blank" rel="noopener noreferrer" className="underline">
              Coinbase
            </a>
            {" | "}
            <a href="https://celo.org/developers/faucet" target="_blank" rel="noopener noreferrer" className="underline">
              Faucet (testnet)
            </a>
          </p>
        </div>
      )}

      {isWrongChain && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800 font-semibold mb-2">
            ⚠️ Wrong Network
          </p>
          <p className="text-sm text-red-700 mb-3">
            Please switch to <strong>Celo Mainnet</strong> (Chain ID: {CELO_MAINNET_CHAIN_ID}) to interact with the game.
            {chainId && (
              <span className="block mt-1">Current: Chain ID {chainId}</span>
            )}
          </p>
          <button
            onClick={handleSwitchChain}
            disabled={isSwitchingChain}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
          >
            {isSwitchingChain ? "Switching..." : "Switch to Celo Mainnet"}
          </button>
        </div>
      )}
    </div>
  );
}

