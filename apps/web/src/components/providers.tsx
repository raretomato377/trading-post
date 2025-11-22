"use client";

import { MiniAppProvider } from "@/contexts/miniapp-context";
import FrameWalletProvider from "@/contexts/frame-wallet-context";
import dynamic from "next/dynamic";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false }
);

export default function Providers({ children }: { children: React.ReactNode }) {
  // Check if we're on localhost - if so, disable auto-add frame
  // Otherwise, enable it (will work in Farcaster preview tool, Warpcast, etc.)
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1');
  
  return (
    <ErudaProvider>
      <FrameWalletProvider>
        <MiniAppProvider addMiniAppOnLoad={!isLocalhost}>{children}</MiniAppProvider>
      </FrameWalletProvider>
    </ErudaProvider>
  );
}
