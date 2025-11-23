"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";

// Create Farcaster connector with error handling
let farcasterConnector;
try {
  farcasterConnector = farcasterMiniApp();
  
  // Workaround: Add getChainId polyfill to prevent "getChainId is not a function" errors
  // Wagmi may call this method during initialization, and the Farcaster connector
  // might not implement it. We always add it to ensure it exists.
  // We use 'any' here because the connector type may not expose getChainId
  const connectorAny = farcasterConnector as any;
  if (connectorAny) {
    // Always override getChainId to ensure it exists, even if the connector has it
    // This prevents errors if the connector's implementation is incomplete
    connectorAny.getChainId = async () => {
      // Try to get chainId from the connector's internal state if available
      // Otherwise default to Celo Mainnet
      try {
        // Check if connector has a way to get chainId (some connectors store it)
        if (connectorAny.chains && connectorAny.chains.length > 0) {
          return connectorAny.chains[0].id;
        }
        // Check if there's a stored chainId
        if (connectorAny.chainId !== undefined) {
          return connectorAny.chainId;
        }
      } catch (e) {
        // Ignore errors, just use default
      }
      return celo.id; // Default to Celo Mainnet
    };
  }
} catch (error) {
  console.error('Failed to initialize Farcaster connector:', error);
  // Fallback: create a minimal connector-like object to prevent crashes
  farcasterConnector = null;
}

const config = createConfig({
  chains: [celo, celoAlfajores], // Celo Mainnet (42220) and Alfajores testnet
  connectors: farcasterConnector ? [farcasterConnector] : [], // Only add if connector was created successfully
  transports: {
    [celo.id]: http('/api/rpc'), // Use local Next.js API proxy to avoid CORS
    [celoAlfajores.id]: http(),
  },
  // Set Celo Mainnet as the default chain
  // This ensures users connect to the correct network
  ssr: false,
});

const queryClient = new QueryClient();

export default function FrameWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
