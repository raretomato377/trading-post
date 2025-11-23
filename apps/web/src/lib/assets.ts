import { Asset } from "@/types/card";

// Pyth Price IDs for Celo Mainnet
// TODO: Update with actual Pyth price IDs for Celo Mainnet
// These are example IDs - replace with real ones from Pyth docs
export const ASSETS: Asset[] = [
  {
    id: "BTC",
    name: "Bitcoin",
    symbol: "BTC",
    pythPriceId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // Example - replace with actual
    type: "crypto",
  },
  {
    id: "ETH",
    name: "Ethereum",
    symbol: "ETH",
    pythPriceId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // Example - replace with actual
    type: "crypto",
  },
  {
    id: "SOL",
    name: "Solana",
    symbol: "SOL",
    pythPriceId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", // Example - replace with actual
    type: "crypto",
  },
  {
    id: "USDC",
    name: "USD Coin",
    symbol: "USDC",
    pythPriceId: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", // Example - replace with actual
    type: "crypto",
  },
  {
    id: "CELO",
    name: "Celo",
    symbol: "CELO",
    pythPriceId: "0x7d669ddcdd23d9ef1fa4aae953c630f8a3dc2f93876c1909b9bc3d5c97116516", // Example - replace with actual
    type: "crypto",
  },
  {
    id: "AAPL",
    name: "Apple Inc.",
    symbol: "AAPL",
    pythPriceId: "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0657e13da4b67300837b07dc87d8", // Example - replace with actual
    type: "stock",
  },
  {
    id: "TSLA",
    name: "Tesla Inc.",
    symbol: "TSLA",
    pythPriceId: "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420758f22c01ecfb37d6ad6be4", // Example - replace with actual
    type: "stock",
  },
  {
    id: "GOOGL",
    name: "Alphabet Inc.",
    symbol: "GOOGL",
    pythPriceId: "0x26b3bc67befc214058ca78ea9a2690298d731a2d4309485ec3d401b68f5c5c5e", // Example - replace with actual
    type: "stock",
  },
];

// Get asset by ID
export function getAssetById(id: string): Asset | undefined {
  return ASSETS.find((asset) => asset.id === id);
}

// Get asset by index
export function getAssetByIndex(index: number): Asset | undefined {
  return ASSETS[index % ASSETS.length];
}

// Get Pyth price ID for asset
export function getPythPriceId(assetId: string): string | undefined {
  const asset = getAssetById(assetId);
  return asset?.pythPriceId;
}

