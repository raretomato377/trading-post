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
  const getChainIdPolyfill = async function(this: any) {
    try {
      // Try to get chainId from various sources on the connector instance
      const instance = this || connectorAny;
      if (instance?.chains && instance.chains.length > 0) {
        return instance.chains[0].id;
      }
      if (instance?.chainId !== undefined) {
        return instance.chainId;
      }
      if (instance?.provider?.chainId) {
        return instance.provider.chainId;
      }
      if (instance?.state?.chainId) {
        return instance.state.chainId;
      }
    } catch (e) {
      // Ignore errors
    }
    return celo.id; // Default to Celo Mainnet
  };
  
  // Use Object.defineProperty to ensure getChainId is always available
  // This makes it non-configurable and ensures it can't be deleted
  Object.defineProperty(connectorAny, 'getChainId', {
    value: getChainIdPolyfill,
    writable: false, // Prevent overwriting
    configurable: true, // Allow redefinition if needed
    enumerable: false, // Don't show in for...in loops
  });
  
  // Patch the prototype chain to ensure all instances have it
  let proto = Object.getPrototypeOf(connectorAny);
  while (proto && proto !== Object.prototype) {
    if (!proto.hasOwnProperty('getChainId')) {
      Object.defineProperty(proto, 'getChainId', {
        value: getChainIdPolyfill,
        writable: false,
        configurable: true,
        enumerable: false,
      });
    }
    proto = Object.getPrototypeOf(proto);
  }
  
  // Wrap in Proxy to intercept all property access
  farcasterConnector = new Proxy(originalConnector, {
    get(target, prop, receiver) {
      if (prop === 'getChainId') {
        // Always return the polyfill, even if the target has it
        return getChainIdPolyfill.bind(target);
      }
      const value = Reflect.get(target, prop, receiver);
      
      // If the value is an object (like a nested connector instance), wrap it too
      if (value && typeof value === 'object' && prop !== 'prototype' && prop !== '__proto__') {
        // Check if it looks like a connector (has common connector properties)
        if ('id' in value || 'name' in value || 'type' in value) {
          return new Proxy(value, {
            get(nestedTarget, nestedProp) {
              if (nestedProp === 'getChainId') {
                return getChainIdPolyfill.bind(nestedTarget);
              }
              return Reflect.get(nestedTarget, nestedProp);
            },
          });
        }
      }
      
      return value;
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
