"use client";
import { useMiniApp } from "@/contexts/miniapp-context";
import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { CardGame } from "@/components/card-game";
import { ResultsDisplay } from "@/components/results-display";
import { Leaderboard } from "@/components/leaderboard";
import { Lobby } from "@/components/lobby";
import { GameStatusDisplay } from "@/components/game-status";
import { useGameState, GameStatus, usePlayerActiveGame } from "@/hooks/use-trading-game";

export default function Home() {
  const { context, isMiniAppReady } = useMiniApp();
  const [mounted, setMounted] = useState(false);

  // Wait for component to mount (client-side only) to avoid hydration warnings
  useEffect(() => {
    setMounted(true);
  }, []);

  // Wallet connection hooks
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const hasAttemptedConnectRef = useRef(false);

  // Check if we're on localhost (not in Farcaster)
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  // Only auto-connect if we have Farcaster context (actually in Farcaster environment)
  const hasFarcasterContext = !!context;

  // Auto-connect wallet when miniapp is ready (only if in Farcaster)
  useEffect(() => {
    // Only auto-connect if:
    // 1. Not on localhost
    // 2. MiniApp is ready
    // 3. We have Farcaster context (actually in Farcaster/Warpcast)
    if (isLocalhost || !hasFarcasterContext) {
      return;
    }

    if (
      mounted &&
      isMiniAppReady &&
      !isConnected &&
      !isConnecting &&
      !hasAttemptedConnectRef.current &&
      connectors.length > 0
    ) {
      // Try to find the Farcaster connector
      const farcasterConnector = connectors.find(
        (c) =>
          c.id === "farcaster" ||
          c.id === "farcasterMiniApp" ||
          c.name?.toLowerCase().includes("farcaster")
      );

      if (farcasterConnector) {
        console.log("🔗 Auto-connecting to Farcaster wallet...", farcasterConnector.id);
        hasAttemptedConnectRef.current = true;
        requestAnimationFrame(() => {
          setTimeout(() => {
            connect({ connector: farcasterConnector });
          }, 200);
        });
      } else {
        console.warn(
          "⚠️ Farcaster connector not found. Available connectors:",
          connectors.map((c) => ({ id: c.id, name: c.name }))
        );
      }
    }
  }, [
    mounted,
    isMiniAppReady,
    isConnected,
    isConnecting,
    connectors,
    connect,
    isLocalhost,
    hasFarcasterContext,
    context,
  ]);

  // Get player's active game from contract - THIS IS THE SOURCE OF TRUTH
  const { activeGameId: currentGameId, isChecking: isCheckingActiveGame } = usePlayerActiveGame(address);

  // Get current game state to determine what to show
  const { gameState } = useGameState(currentGameId);

  // Extract user data from context
  const user = context?.user;
  const displayName = user?.displayName || user?.username || "User";

  // Determine what phase we're in
  // If player has an active game (even in LOBBY), show that game (not the lobby)
  // Only show lobby if player has NO active game
  // Show game if player has an active game that's not ENDED (or if gameState is still loading)
  // Show results if player's game has ended
  
  // Ensure currentGameId is a bigint for comparison
  const activeGameId = currentGameId && typeof currentGameId === 'bigint' ? currentGameId : 
                       currentGameId ? BigInt(String(currentGameId)) : undefined;
  
  const hasActiveGame = activeGameId !== undefined && activeGameId > 0n; // Player is in a game
  
  // Only show lobby if player has NO active game at all
  const showLobby = !hasActiveGame && !isCheckingActiveGame;
  // Show game if player has an active game that's not ended (including LOBBY state)
  // Also show game if gameState is still loading (we know they're in a game)
  const showGame = hasActiveGame && (!gameState || gameState.status !== GameStatus.ENDED);
  // Show results if player's game has ended
  const showResults = hasActiveGame && gameState?.status === GameStatus.ENDED;
  
  // Debug logging
  useEffect(() => {
    console.log('🎮 [Page] Game display logic:', {
      currentGameId: currentGameId?.toString(),
      activeGameId: activeGameId?.toString(),
      hasActiveGame,
      gameStateStatus: gameState?.status,
      showLobby,
      showGame,
      showResults,
      isCheckingActiveGame,
    });
  }, [currentGameId, activeGameId, hasActiveGame, gameState?.status, showLobby, showGame, showResults, isCheckingActiveGame]);

  // Don't render until mounted and ready (prevents hydration warnings)
  if (!mounted || !isMiniAppReady) {
    return (
      <main className="flex-1">
        <section className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="w-full max-w-md mx-auto p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <section className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="w-full max-w-6xl mx-auto px-4 space-y-8">
          {/* User Info and Wallet - Side by side bubbles */}
          {(context?.user || hasFarcasterContext) && (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {context?.user && (
                <div className="inline-flex items-center gap-2 bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span className="text-xs text-gray-700">{displayName}</span>
                </div>
              )}
              {hasFarcasterContext && (
                <div className="inline-flex items-center gap-2 bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  {isConnecting ? (
                    <span className="text-xs text-gray-600">Connecting...</span>
                  ) : isConnected && address ? (
                    <span className="text-xs text-gray-700">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  ) : (
                    <span className="text-xs text-yellow-600">Not connected</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lobby Component - Show when no game or game in LOBBY */}
          {showLobby && (
            <Lobby />
          )}

          {/* Game Status Display - Show when game is active */}
          {showGame && <GameStatusDisplay gameId={activeGameId} />}

          {/* Card Game Component - Show when game is ACTIVE or CHOICE */}
          {showGame && (
            <CardGame
              gameId={activeGameId}
              maxSelections={3}
              onChoicesCommitted={() => {
                console.log("Choices committed!");
              }}
            />
          )}

          {/* Results Display - Show when game has ended */}
          {showResults && <ResultsDisplay gameId={activeGameId} />}

          {/* Leaderboard - Always show */}
          <Leaderboard limit={10} />
        </div>
      </section>
    </main>
  );
}
