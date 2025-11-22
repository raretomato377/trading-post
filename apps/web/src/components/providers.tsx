"use client";

import { MiniAppProvider } from "@/contexts/miniapp-context";
import FrameWalletProvider from "@/contexts/frame-wallet-context";
import dynamic from "next/dynamic";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false }
);

export default function Providers({ children }: { children: React.ReactNode }) {
  // Disable auto-add frame for localhost testing
  // Set to true when deploying to Farcaster
  const isFarcasterEnvironment = typeof window !== 'undefined' && 
    (window.location.hostname.includes('farcaster') || 
     window.location.hostname.includes('warpcast'));
  
  return (
    <ErudaProvider>
      <FrameWalletProvider>
        <MiniAppProvider addMiniAppOnLoad={isFarcasterEnvironment}>{children}</MiniAppProvider>
      </FrameWalletProvider>
    </ErudaProvider>
  );
}
