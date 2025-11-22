import { NextResponse } from "next/server";

const PYTH_HERMES_API = 'https://hermes.pyth.network/v2/updates/price/latest';
const BTC_USD_FEED_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';

/**
 * Format Pyth price to human-readable number
 */
function formatPythPrice(price: string, expo: number): number {
  const priceNum = parseInt(price);
  return priceNum * Math.pow(10, expo);
}

export async function GET() {
  try {
    const url = `${PYTH_HERMES_API}?ids[]=${BTC_USD_FEED_ID}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP error! status: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.parsed || data.parsed.length === 0) {
      return NextResponse.json(
        { error: 'No price data found' },
        { status: 404 }
      );
    }

    const priceData = data.parsed[0];
    const price = priceData.price;
    const emaPrice = priceData.ema_price;

    // Format prices
    const formattedPrice = formatPythPrice(price.price, price.expo);
    const formattedConf = formatPythPrice(price.conf, price.expo);
    const formattedEmaPrice = formatPythPrice(emaPrice.price, emaPrice.expo);
    const formattedEmaConf = formatPythPrice(emaPrice.conf, emaPrice.expo);

    return NextResponse.json({
      symbol: 'BTC/USD',
      feedId: `0x${priceData.id}`,
      price: {
        current: formattedPrice,
        confidence: formattedConf,
        publishTime: new Date(price.publish_time * 1000).toISOString(),
        publishTimeUnix: price.publish_time
      },
      emaPrice: {
        current: formattedEmaPrice,
        confidence: formattedEmaConf,
        publishTime: new Date(emaPrice.publish_time * 1000).toISOString(),
        publishTimeUnix: emaPrice.publish_time
      },
      raw: priceData
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
