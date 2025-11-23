import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import { Navbar } from '@/components/navbar';
import Providers from "@/components/providers"

const inter = Inter({ subsets: ['latin'] });

const appUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

// Embed metadata for Farcaster sharing
// fc:frame is for frames, fc:miniapp is for miniapps
const miniappMeta = {
  version: "1",
  imageUrl: `${appUrl}/opengraph-image.png`,
  button: {
    title: "Launch App",
    action: {
      type: "launch_frame",
      name: "Proof of Alpha",
      url: appUrl,
      splashImageUrl: `${appUrl}/icon.png`,
      splashBackgroundColor: "#ffffff",
    },
  },
};

export const metadata: Metadata = {
  title: 'Proof of Alpha',
  description: 'A trading game',
  openGraph: {
    title: 'Proof of Alpha',
    description: 'A trading game',
    images: [`${appUrl}/opengraph-image.png`],
  },
  other: {
    // fc:miniapp meta tag for miniapp embeds in casts
    "fc:miniapp": JSON.stringify(miniappMeta),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Navbar is included on all pages */}
        <div className="relative flex min-h-screen flex-col">
          <Providers>
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </Providers>
        </div>
      </body>
    </html>
  );
}
