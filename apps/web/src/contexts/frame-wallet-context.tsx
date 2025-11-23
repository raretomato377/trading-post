"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";

// Create Farcaster connector with error handling and getChainId polyfill
let farcasterConnector;
try {
  const originalConnector = farcasterMiniApp();
  const connectorAny = originalConnector as any;
  
  // Define getChainId polyfill function
  const getChainIdPolyfill = async () => {
    try {
      // Try to get chainId from various sources on the connector
      if (connectorAny.chains && connectorAny.chains.length > 0) {
        return connectorAny.chains[0].id;
      }
      if (connectorAny.chainId !== undefined) {
        return connectorAny.chainId;
      }
      if (connectorAny.provider?.chainId) {
        return connectorAny.provider.chainId;
      }
      if (connectorAny.state?.chainId) {
        return connectorAny.state.chainId;
      }
    } catch (e) {
      // Ignore errors
    }
    return celo.id; // Default to Celo Mainnet
  };
  
  // Add getChainId directly to the connector object
  if (typeof connectorAny.getChainId !== 'function') {
    connectorAny.getChainId = getChainIdPolyfill;
  }
  
  // Also patch the prototype if it exists
  if (connectorAny.constructor?.prototype) {
    const prototype = connectorAny.constructor.prototype;
    if (typeof prototype.getChainId !== 'function') {
      prototype.getChainId = getChainIdPolyfill;
    }
  }
  
  // Wrap in Proxy to catch any getChainId calls that might bypass the direct property
  farcasterConnector = new Proxy(originalConnector, {
    get(target, prop, receiver) {
      if (prop === 'getChainId') {
        const originalMethod = (target as any).getChainId;
        if (typeof originalMethod === 'function') {
          return originalMethod.bind(target);
        }
        return getChainIdPolyfill;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
} catch (error) {
  console.error('Failed to initialize Farcaster connector:', error);
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
