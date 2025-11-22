// Pyth Network Price Feed IDs
// Documentation: https://docs.pyth.network/price-feeds/price-feed-ids

export const PYTH_PRICE_FEEDS = {
  // Equities
  TSLA_USD: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  AAPL_USD: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  MSFT_USD: '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',

  // Crypto (commented out - add as needed)
  // BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  // ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  // SOL_USD: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
} as const;

// Pyth Hermes API endpoint
export const PYTH_HERMES_API = 'https://hermes.pyth.network/v2/updates/price/latest';

/**
 * Helper function to convert Pyth price to human-readable format
 * @param price The price value from Pyth (string or bigint)
 * @param expo The exponent from Pyth (int32)
 * @returns The price as a number
 */
export function formatPythPrice(price: string | bigint, expo: number): number {
  const priceNum = typeof price === 'string' ? parseInt(price) : Number(price);
  return priceNum * Math.pow(10, expo);
}
