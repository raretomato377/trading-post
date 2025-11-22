"use client";
import { sdk } from "@farcaster/frame-sdk";
// Use any types for Farcaster SDK compatibility
type FrameContext = any;
type AddFrameResult = any;
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import FrameWalletProvider from "./frame-wallet-context";

interface MiniAppContextType {
  isMiniAppReady: boolean;
  context: FrameContext | null;
  setMiniAppReady: () => void;
  addMiniApp: () => Promise<AddFrameResult | null>;
}

const MiniAppContext = createContext<MiniAppContextType | undefined>(undefined);

interface MiniAppProviderProps {
  addMiniAppOnLoad?: boolean;
  children: ReactNode;
}

export function MiniAppProvider({ children, addMiniAppOnLoad }: MiniAppProviderProps): JSX.Element {
  const [context, setContext] = useState<FrameContext | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Check if we're in Farcaster environment
  const isFarcasterEnv = typeof window !== 'undefined' && 
    (window.location.hostname.includes('farcaster') || 
     window.location.hostname.includes('warpcast'));
  
  // For localhost testing, skip SDK initialization and set ready immediately
  const [isMiniAppReady, setIsMiniAppReady] = useState(!isFarcasterEnv);

  // Set mounted state after component mounts (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  const setMiniAppReady = useCallback(async () => {
    try {
      const context = await sdk.context;
      if (context) {
        setContext(context);
      }
      await sdk.actions.ready();
    } catch (err) {
      console.error("SDK initialization error:", err);
    } finally {
      setIsMiniAppReady(true);
    }
  }, []);

  useEffect(() => {
    // Only initialize SDK if we're in Farcaster environment
    // For localhost, skip SDK initialization to avoid hydration issues
    if (mounted && !isMiniAppReady && isFarcasterEnv) {
      // Use requestAnimationFrame to ensure it runs after hydration
      requestAnimationFrame(() => {
        setTimeout(() => {
          setMiniAppReady().then(() => {
            console.log("MiniApp loaded");
          });
        }, 100);
      });
    } else if (!isFarcasterEnv && mounted) {
      // For localhost, just log that we're ready
      console.log("MiniApp ready (localhost mode)");
    }
  }, [mounted, isMiniAppReady, isFarcasterEnv, setMiniAppReady]);

  const handleAddMiniApp = useCallback(async () => {
    try {
      // Check if we're in a Farcaster context before trying to add frame
      const context = await sdk.context;
      if (!context) {
        // Not in Farcaster context (e.g., localhost testing)
        return null;
      }
      
      const result = await sdk.actions.addFrame();
      // Return result if it exists, otherwise null
      return result || null;
    } catch (error) {
      // Silently handle errors - this is expected when testing on localhost
      // The error might be due to frame already being added or not being in Farcaster context
      return null;
    }
  }, []);

  useEffect(() => {
    // on load, set the frame as ready - only after mounted
    if (mounted && isMiniAppReady && !context?.client?.added && addMiniAppOnLoad) {
      // Defer the call to avoid render issues
      requestAnimationFrame(() => {
        setTimeout(() => {
          handleAddMiniApp().catch((err) => {
            // Silently handle - this is expected in some contexts
            if (err instanceof Error) {
              console.error("Error adding miniapp:", err.message);
            }
          });
        }, 100);
      });
    }
  }, [
    mounted,
    isMiniAppReady,
    context?.client?.added,
    handleAddMiniApp,
    addMiniAppOnLoad,
  ]);

  return (
    <MiniAppContext.Provider
      value={{
        isMiniAppReady,
        setMiniAppReady,
        addMiniApp: handleAddMiniApp,
        context,
      }}
    >
      <FrameWalletProvider>{children}</FrameWalletProvider>
    </MiniAppContext.Provider>
  );
}

export function useMiniApp(): MiniAppContextType {
  const context = useContext(MiniAppContext);
  if (context === undefined) {
    throw new Error("useMiniApp must be used within a MiniAppProvider");
  }
  return context;
}
