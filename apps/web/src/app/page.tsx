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

  // State to track the ended game ID (so we can show results even after playerActiveGame is cleared)
  const [endedGameId, setEndedGameId] = useState<bigint | undefined>(undefined);
  
  // State to track if we're showing results (to stop polling)
  const [showingResults, setShowingResults] = useState(false);
  
  // Track the last known game state to prevent flickering
  // Once we've seen a gameState, keep it until we explicitly leave the game
  const [lastKnownGameState, setLastKnownGameState] = useState<typeof gameState>(undefined);

  // Determine which gameId to use: current active game, or ended game if we're showing results
  const gameIdForState = showingResults && endedGameId ? endedGameId : currentGameId;

  // Get current game state to determine what to show
  // Don't poll when showing results
  const { gameState, isLoading: isLoadingGameState } = useGameState(showingResults ? undefined : gameIdForState);
  
  // Track last known game state to prevent flickering
  useEffect(() => {
    if (gameState) {
      setLastKnownGameState(gameState);
    } else if (currentGameId === undefined || currentGameId === 0n) {
      // Only clear lastKnownGameState if we truly have no active game
      setLastKnownGameState(undefined);
    }
    // Otherwise, keep the last known state to prevent flickering
  }, [gameState, currentGameId]);
  
  // Debug: Log game state fetching
  useEffect(() => {
    console.log('🎮 [Page] Game state fetch:', {
      currentGameId: currentGameId?.toString(),
      isLoadingGameState,
      gameStateStatus: gameState?.status,
      hasGameState: !!gameState,
      lastKnownStatus: lastKnownGameState?.status,
    });
  }, [currentGameId, isLoadingGameState, gameState?.status, lastKnownGameState?.status]);

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
  
  // Use gameState if available, otherwise fall back to lastKnownGameState to prevent flickering
  const effectiveGameState = gameState || lastKnownGameState;
  
  // Determine if we're in a game based on multiple signals
  // We're in a game if:
  // 1. We have an activeGameId, OR
  // 2. We have a gameState (current or last known) that's not ENDED, OR
  // 3. We're currently checking for an active game (don't show lobby during check)
  const isInGame = hasActiveGame || 
                   (effectiveGameState && effectiveGameState.status !== GameStatus.ENDED) || 
                   isCheckingActiveGame;
  
  // Only show lobby if:
  // 1. We're NOT in a game (no activeGameId, no gameState, not checking)
  // 2. We're NOT showing results
  // 3. We don't have an ended game ID
  const showLobby = !isInGame && !showingResults && !endedGameId;
  
  // Show game if:
  // 1. We're in a game (has activeGameId or gameState), AND
  // 2. Game is not ENDED, AND
  // 3. We're not showing results
  const showGame = isInGame && !showingResults && effectiveGameState?.status !== GameStatus.ENDED;
  // Track when a game ends so we can continue showing results even after playerActiveGame is cleared
  // Once showingResults is true, keep it true until user explicitly goes back
  useEffect(() => {
    if (effectiveGameState?.status === GameStatus.ENDED && gameIdForState) {
      // Store the ended game ID so we can continue showing results
      setEndedGameId(gameIdForState);
      setShowingResults(true);
      console.log('🎮 [Page] Game ended, setting showingResults to true:', {
        gameId: gameIdForState.toString(),
        status: effectiveGameState.status,
      });
    }
    // Don't clear showingResults automatically - only clear when user clicks back
    // This prevents the results page from disappearing
  }, [effectiveGameState?.status, gameIdForState]);
  
  // Show results if:
  // 1. We're explicitly showing results (showingResults flag), OR
  // 2. We have an ended game ID stored (persists even after playerActiveGame is cleared), OR
  // 3. Player's game has ended (hasActiveGame && effectiveGameState?.status === ENDED)
  // Priority: showingResults flag > endedGameId > current state check
  const showResults = showingResults || 
                      (endedGameId !== undefined) ||
                      (hasActiveGame && effectiveGameState?.status === GameStatus.ENDED);
  
  // Handle back from results - clear the showing results state and refresh
  const handleBackFromResults = () => {
    setShowingResults(false);
    setEndedGameId(undefined);
    // Force a refresh to get the latest active game state
    window.location.reload();
  };
  
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
      isLoadingGameState,
      hasGameState: !!gameState,
    });
    
    if (showLobby) {
      console.log('🎮 [Page] ⚠️ Rendering Lobby - showLobby:', showLobby, 'hasActiveGame:', hasActiveGame, 'isCheckingActiveGame:', isCheckingActiveGame);
    }
    
    if (showGame && activeGameId) {
      console.log('🎮 [Page] ✅ Rendering game components:', {
        showGame,
        activeGameId: activeGameId.toString(),
        activeGameIdType: typeof activeGameId,
        gameStateStatus: gameState?.status,
        hasGameState: !!gameState,
      });
    }
    
    if (showResults) {
      console.log('🎮 [Page] 🏆 Rendering Results:', {
        showResults,
        showingResults,
        endedGameId: endedGameId?.toString(),
        activeGameId: activeGameId?.toString(),
        effectiveGameStateStatus: effectiveGameState?.status,
        hasActiveGame,
      });
    }
    
    if (showLobby) {
      console.log('🎮 [Page] ⚠️ Rendering Lobby - showLobby:', showLobby, 'hasActiveGame:', hasActiveGame, 'isCheckingActiveGame:', isCheckingActiveGame);
    }
  }, [currentGameId, activeGameId, hasActiveGame, gameState?.status, showLobby, showGame, showResults, isCheckingActiveGame, isLoadingGameState]);

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
          {showGame && gameIdForState && (
            <GameStatusDisplay gameId={gameIdForState} />
          )}

          {/* Card Game Component - Show when game is ACTIVE or CHOICE */}
          {showGame && gameIdForState && (
            <CardGame
              gameId={gameIdForState}
              maxSelections={3}
              onChoicesCommitted={() => {
                console.log("Choices committed!");
              }}
            />
          )}

          {/* Results Display - Show when game has ended */}
          {showResults && <ResultsDisplay gameId={endedGameId || activeGameId} onBack={handleBackFromResults} />}

          {/* Leaderboard - Always show */}
          <Leaderboard limit={10} />
        </div>
      </section>
    </main>
  );
}
