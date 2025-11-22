/**
 * Script to fetch price data from Pyth Hermes API for all configured price feeds
 * Usage: node scripts/fetch-pyth-price.js
 */

const PYTH_HERMES_API = 'https://hermes.pyth.network/v2/updates/price/latest';

// Price feed IDs to fetch
const PRICE_FEEDS = {
  'TSLA/USD': '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  'AAPL/USD': '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  'MSFT/USD': '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
};

/**
 * Format Pyth price to human-readable number
 */
function formatPythPrice(price, expo) {
  const priceNum = parseInt(price);
  return priceNum * Math.pow(10, expo);
}

/**
 * Fetch all prices from Pyth Hermes API
 */
async function fetchAllPrices() {
  try {
    // Build URL with all price feed IDs
    const priceIds = Object.values(PRICE_FEEDS);
    const idsParams = priceIds.map(id => `ids[]=${id}`).join('&');
    const url = `${PYTH_HERMES_API}?${idsParams}`;

    console.log('\n🔄 Fetching prices for all feeds...\n');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.parsed || data.parsed.length === 0) {
      console.error('No price data found');
      return;
    }

    // Display binary data
    console.log('═'.repeat(80));
    console.log('📦 BINARY DATA (for on-chain updates)');
    console.log('═'.repeat(80));
    console.log('\nBinary Data Array:');
    console.log(JSON.stringify(data.binary.data, null, 2));
    console.log('\nEncoding: ' + data.binary.encoding);
    console.log('═'.repeat(80));
    console.log('\n');

    // Display parsed data for each feed
    for (const priceData of data.parsed) {
      const feedName = Object.keys(PRICE_FEEDS).find(
        key => PRICE_FEEDS[key] === `0x${priceData.id}`
      ) || 'Unknown';

      const price = priceData.price;
      const emaPrice = priceData.ema_price;

      // Format prices
      const formattedPrice = formatPythPrice(price.price, price.expo);
      const formattedConf = formatPythPrice(price.conf, price.expo);
      const formattedEmaPrice = formatPythPrice(emaPrice.price, emaPrice.expo);

      // Display results
      console.log('═'.repeat(80));
      console.log(`📊 ${feedName} PRICE FEED`);
      console.log('═'.repeat(80));
      console.log(`Feed ID:        0x${priceData.id}`);
      console.log(`\n💰 Current Price:  $${formattedPrice.toFixed(2)}`);
      console.log(`   Confidence:     ±$${formattedConf.toFixed(2)}`);
      console.log(`   Publish Time:   ${new Date(price.publish_time * 1000).toLocaleString()}`);
      console.log(`\n📈 EMA Price:      $${formattedEmaPrice.toFixed(2)}`);
      console.log(`   EMA Confidence: ±$${formatPythPrice(emaPrice.conf, emaPrice.expo).toFixed(2)}`);
      console.log(`   EMA Publish:    ${new Date(emaPrice.publish_time * 1000).toLocaleString()}`);
      console.log('\n📦 Parsed Data (Deserialized):');
      console.log(JSON.stringify(priceData, null, 2));
      console.log('═'.repeat(80));
      console.log('\n');
    }

  } catch (error) {
    console.error('Error fetching prices:', error.message);
    process.exit(1);
  }
}

// Run the script
fetchAllPrices();
