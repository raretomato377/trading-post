"use client";
import { useMiniApp } from "@/contexts/miniapp-context";
import { useState, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { CardGame } from "@/components/card-game";

export default function Home() {
  const { context, isMiniAppReady } = useMiniApp();
  
  // Wallet connection hooks
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  
  // Auto-connect wallet when miniapp is ready
  useEffect(() => {
    if (isMiniAppReady && !isConnected && !isConnecting && connectors.length > 0) {
      const farcasterConnector = connectors.find(c => c.id === 'farcaster');
      if (farcasterConnector) {
        connect({ connector: farcasterConnector });
      }
    }
  }, [isMiniAppReady, isConnected, isConnecting, connectors, connect]);
  
  // Extract user data from context
  const user = context?.user;
  const displayName = user?.displayName || user?.username || "User";
  
  // Handle card selection
  const handleCardSelected = (card: { suit: string; value: string; id: string }) => {
    console.log("Card selected:", card);
  };

  // Handle proceed action
  const handleProceed = (card: { suit: string; value: string; id: string }) => {
    console.log("Proceeding with card:", card);
    // You can add additional logic here, such as:
    // - Saving to blockchain via wagmi
    // - Making an API call
    // - Navigating to next step
    alert(`Proceeding with ${card.value} ${card.suit}!`);
  };
  
  if (!isMiniAppReady) {
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
        <div className="w-full max-w-4xl mx-auto px-4">
          {/* User Info Header */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 bg-white/30 backdrop-blur-sm px-4 py-2 rounded-full">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-gray-400'
              }`}></div>
              <span className="text-sm text-gray-700">
                {isConnected ? `Connected as ${displayName}` : isConnecting ? 'Connecting...' : 'Not connected'}
              </span>
            </div>
          </div>

          {/* Card Game Component */}
          <CardGame onCardSelected={handleCardSelected} onProceed={handleProceed} />
        </div>
      </section>
    </main>
  );
}
