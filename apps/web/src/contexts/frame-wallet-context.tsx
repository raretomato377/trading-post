"use client";

import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { celo, celoAlfajores } from "wagmi/chains";

const config = createConfig({
  chains: [celo, celoAlfajores], // Celo Mainnet (42220) and Alfajores testnet
  connectors: [farcasterMiniApp()], // Farcaster connector doesn't accept arguments
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
