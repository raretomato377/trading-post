"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";

// Global polyfill for getChainId - patch the farcasterMiniApp function itself
// This ensures any connector created will have getChainId available
const originalFarcasterMiniApp = farcasterMiniApp;
const patchedFarcasterMiniApp = (() => {
  const connector = originalFarcasterMiniApp();
  const connectorAny = connector as any;
  
  // Ensure getChainId exists
  if (!connectorAny.getChainId || typeof connectorAny.getChainId !== 'function') {
    Object.defineProperty(connectorAny, 'getChainId', {
      value: async function() {
        try {
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
        return celo.id;
      },
      writable: false,
      configurable: true,
      enumerable: false,
    });
  }
  
  return connector;
})();

// Create Farcaster connector with error handling and getChainId polyfill
let farcasterConnector;
try {
  const originalConnector = patchedFarcasterMiniApp;
  const connectorAny = originalConnector as any;
  
  // Define getChainId polyfill function (both sync and async versions)
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
  
  // Also create a synchronous version in case Wagmi calls it synchronously
  const getChainIdSync = function(this: any) {
    try {
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
  
  // Helper function to patch any object that looks like a connector
  const patchConnector = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    // Patch getChainId if it doesn't exist or is not a function
    if (!obj.getChainId || typeof obj.getChainId !== 'function') {
      try {
        Object.defineProperty(obj, 'getChainId', {
          value: getChainIdPolyfill,
          writable: false,
          configurable: true,
          enumerable: false,
        });
      } catch (e) {
        // If defineProperty fails, try direct assignment
        try {
          (obj as any).getChainId = getChainIdPolyfill;
        } catch (e2) {
          // Ignore
        }
      }
    }
    
    // Also patch the prototype
    let proto = Object.getPrototypeOf(obj);
    while (proto && proto !== Object.prototype) {
      if (!proto.hasOwnProperty('getChainId')) {
        try {
          Object.defineProperty(proto, 'getChainId', {
            value: getChainIdPolyfill,
            writable: false,
            configurable: true,
            enumerable: false,
          });
        } catch (e) {
          // Ignore
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
  };
  
  // Patch the original connector immediately
  patchConnector(connectorAny);
  
  // Wrap in Proxy to intercept all property access and patch on-the-fly
  farcasterConnector = new Proxy(originalConnector, {
    get(target, prop, receiver) {
      if (prop === 'getChainId') {
        // Always return the polyfill, even if the target has it
        return getChainIdPolyfill.bind(target);
      }
      
      const value = Reflect.get(target, prop, receiver);
      
      // If the value is an object, patch it if it looks like a connector
      if (value && typeof value === 'object' && prop !== 'prototype' && prop !== '__proto__') {
        // Check if it looks like a connector (has common connector properties)
        if ('id' in value || 'name' in value || 'type' in value || 'chains' in value) {
          patchConnector(value);
          return new Proxy(value, {
            get(nestedTarget, nestedProp) {
              if (nestedProp === 'getChainId') {
                return getChainIdPolyfill.bind(nestedTarget);
              }
              const nestedValue = Reflect.get(nestedTarget, nestedProp);
              // Recursively patch nested connector-like objects
              if (nestedValue && typeof nestedValue === 'object' && 
                  ('id' in nestedValue || 'name' in nestedValue || 'type' in nestedValue || 'chains' in nestedValue)) {
                patchConnector(nestedValue);
              }
              return nestedValue;
            },
          });
        }
      }
      
      return value;
    },
    
    // Also intercept property setting to ensure getChainId can't be overwritten
    set(target, prop, value) {
      if (prop === 'getChainId') {
        // Don't allow overwriting getChainId
        return true;
      }
      return Reflect.set(target, prop, value);
    },
  });
  
  // Patch the connector class/constructor if it exists
  try {
    const ConnectorClass = (farcasterMiniApp as any).constructor || (farcasterMiniApp as any);
    if (ConnectorClass && ConnectorClass.prototype) {
      patchConnector(ConnectorClass.prototype);
    }
  } catch (e) {
    // Ignore if we can't patch the class
  }
} catch (error) {
  console.error('Failed to initialize Farcaster connector:', error);
  farcasterConnector = null;
}

// Create a wrapper function that ensures getChainId is always patched
const ensureGetChainIdPatched = (connector: any) => {
  if (!connector) return connector;
  
  // If getChainId doesn't exist or is not a function, patch it
  if (!connector.getChainId || typeof connector.getChainId !== 'function') {
    try {
      Object.defineProperty(connector, 'getChainId', {
        value: async function() {
          try {
            if (this?.chains && this.chains.length > 0) {
              return this.chains[0].id;
            }
            if (this?.chainId !== undefined) {
              return this.chainId;
            }
            if (this?.provider?.chainId) {
              return this.provider.chainId;
            }
            if (this?.state?.chainId) {
              return this.state.chainId;
            }
          } catch (e) {
            // Ignore errors
          }
          return celo.id;
        },
        writable: false,
        configurable: true,
        enumerable: false,
      });
    } catch (e) {
      // If defineProperty fails, try direct assignment
      try {
        connector.getChainId = async function() {
          return celo.id;
        };
      } catch (e2) {
        // Ignore
      }
    }
  }
  
  return connector;
};

const config = createConfig({
  chains: [celo, celoAlfajores], // Celo Mainnet (42220) and Alfajores testnet
  connectors: farcasterConnector ? [ensureGetChainIdPatched(farcasterConnector)] : [], // Only add if connector was created successfully
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
