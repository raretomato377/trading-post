"use client";
import { useMiniApp } from "@/contexts/miniapp-context";
import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { CardGame } from "@/components/card-game";
import { ResultsDisplay } from "@/components/results-display";
import { Leaderboard } from "@/components/leaderboard";
import { Card } from "@/types/card";

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
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1');
  
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
      // The connector ID might be 'farcaster' or something else
      const farcasterConnector = connectors.find(c => 
        c.id === 'farcaster' || 
        c.id === 'farcasterMiniApp' ||
        c.name?.toLowerCase().includes('farcaster')
      );
      
      if (farcasterConnector) {
        console.log('🔗 Auto-connecting to Farcaster wallet...', farcasterConnector.id);
        hasAttemptedConnectRef.current = true;
        requestAnimationFrame(() => {
          setTimeout(() => {
            connect({ connector: farcasterConnector });
          }, 200);
        });
      } else {
        console.warn('⚠️ Farcaster connector not found. Available connectors:', connectors.map(c => ({ id: c.id, name: c.name })));
      }
    }
  }, [mounted, isMiniAppReady, isConnected, isConnecting, connectors, connect, isLocalhost, hasFarcasterContext, context]);
  
  // Extract user data from context
  const user = context?.user;
  const displayName = user?.displayName || user?.username || "User";
  
  // Card selection state
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  
  // Handle card selection
  const handleCardsSelected = (cards: Card[]) => {
    setSelectedCards(cards);
    console.log("Cards selected:", cards);
  };

  // Handle proceed action
  const handleProceed = (cards: Card[]) => {
    console.log("Proceeding with cards:", cards);
    // TODO: Additional logic when contract is ready
    // - Update prices via Pyth
    // - Submit to contract
    // - Navigate to results
  };
  
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
          {/* User Info Header - Only show in Farcaster */}
          {context?.user && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full">
                <span className="text-sm text-gray-700">
                  {displayName}
                </span>
              </div>
            </div>
          )}

          {/* Wallet Connection Status - Show when not on localhost */}
          {!isLocalhost && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full">
                {isConnecting ? (
                  <span className="text-sm text-gray-600">Connecting wallet...</span>
                ) : isConnected && address ? (
                  <span className="text-sm text-gray-700">
                    Wallet: {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                ) : (
                  <span className="text-sm text-yellow-600">Wallet not connected</span>
                )}
              </div>
            </div>
          )}

          {/* Card Game Component */}
          <CardGame 
            onCardsSelected={handleCardsSelected} 
            onProceed={handleProceed}
            maxSelections={3}
            cardCount={10}
          />

          {/* Results Display */}
          <ResultsDisplay />

          {/* Leaderboard */}
          <Leaderboard limit={10} />
        </div>
      </section>
    </main>
  );
}
