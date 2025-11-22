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
  const [hasAttemptedInit, setHasAttemptedInit] = useState(false);
  
  // Start as not ready - we'll try to initialize SDK
  const [isMiniAppReady, setIsMiniAppReady] = useState(false);

  // Set mounted state after component mounts (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  const setMiniAppReady = useCallback(async () => {
    try {
      // Try to get SDK context - this will work if we're in Farcaster
      const context = await sdk.context;
      if (context) {
        console.log("✅ Farcaster SDK context available", context);
        setContext(context);
        // Call ready() to signal the app is loaded
        await sdk.actions.ready();
        console.log("✅ Called sdk.actions.ready()");
        setIsMiniAppReady(true);
      } else {
        // No context means we're not in Farcaster (e.g., localhost)
        console.log("ℹ️ No Farcaster context - running in localhost mode");
        setIsMiniAppReady(true);
      }
    } catch (err) {
      // If SDK is not available, we're probably on localhost
      console.log("ℹ️ Farcaster SDK not available - running in localhost mode", err);
      setIsMiniAppReady(true);
    }
  }, []);

  useEffect(() => {
    // Try to initialize SDK when component mounts
    // This will work in Farcaster preview tool, Warpcast, or any Farcaster client
    if (mounted && !hasAttemptedInit) {
      setHasAttemptedInit(true);
      // Use requestAnimationFrame to ensure it runs after hydration
      requestAnimationFrame(() => {
        setTimeout(() => {
          setMiniAppReady();
        }, 100);
      });
    }
  }, [mounted, hasAttemptedInit, setMiniAppReady]);

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
