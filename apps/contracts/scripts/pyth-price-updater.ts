import { ethers } from "ethers";
import dotenv from "dotenv";
import { execSync } from "child_process";

// Load environment variables
dotenv.config();

// Configuration - hardcoded values
const RPC_URL = "https://forno.celo.org"; // Celo mainnet
const PYTH_CONTRACT_ADDRESS = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C"; // Celo mainnet
const HERMES_URL = "https://hermes.pyth.network/v2/updates/price/latest";
const UPDATE_INTERVAL = 60 * 1000; // 60 seconds in milliseconds

const PRICE_FEEDS = [
  // -- Original Entries --
  { name: "BTC/USD", id: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
  { name: "ETH/USD", id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
  { name: "SHIB/USD", id: "0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a" },

  // -- Extended Top Coins --
  { name: "SOL/USD", id: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" }, // Solana
  { name: "BNB/USD", id: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f" }, // Binance Coin
  { name: "DOGE/USD", id: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c" }, // Dogecoin
  { name: "XRP/USD", id: "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8" }, // Ripple
  { name: "ADA/USD", id: "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d" }, // Cardano
  { name: "AVAX/USD", id: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7" }, // Avalanche
  { name: "MATIC/USD", id: "0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52" }, // Polygon
  { name: "DOT/USD", id: "0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b" }, // Polkadot
  { name: "LINK/USD", id: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221" }, // Chainlink
  { name: "LTC/USD", id: "0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54" }, // Litecoin
  { name: "BCH/USD", id: "0x3dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a3" }, // Bitcoin Cash
  { name: "UNI/USD", id: "0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501" }, // Uniswap
  { name: "XLM/USD", id: "0xb7a8eba68a997cd0210c2e1e4ee811ad2d174b3611c22d9ebf16f4cb7e9ba850" }, // Stellar
  { name: "NEAR/USD", id: "0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750" }, // Near Protocol
  { name: "ATOM/USD", id: "0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819" }, // Cosmos
  { name: "ALGO/USD", id: "0xfa17ceaf30d19ba51112fdcc750cc83454776f47fb0112e4af07f15f4bb1ebc0" }, // Algorand
];

// Only get private key from .env
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Parse command-line arguments
function parseArgs(): { numItems: number; maxAge: number } {
  const args = process.argv.slice(2);

  // Look for --num-items flag
  const numItemsIndex = args.findIndex(arg => arg === '--num-items' || arg === '-n');
  // Look for --max-age flag
  const maxAgeIndex = args.findIndex(arg => arg === '--max-age' || arg === '-m');

  // Check if both required flags are present
  const missingFlags: string[] = [];
  if (numItemsIndex === -1 || numItemsIndex === args.length - 1) {
    missingFlags.push('--num-items');
  }
  if (maxAgeIndex === -1 || maxAgeIndex === args.length - 1) {
    missingFlags.push('--max-age');
  }

  if (missingFlags.length > 0) {
    console.error(`Error: Required flag(s) missing: ${missingFlags.join(', ')}`);
    console.error('');
    console.error('Usage:');
    console.error('  npm run pyth:update -- --num-items <N> --max-age <seconds>');
    console.error('  node scripts/pyth-price-updater.ts --num-items <N> --max-age <seconds>');
    console.error('');
    console.error('Flags:');
    console.error('  --num-items, -n   Number of price feeds to update (1 to ' + PRICE_FEEDS.length + ')');
    console.error('  --max-age, -m     Maximum acceptable age of price data in seconds');
    console.error('');
    console.error('Examples:');
    console.error('  npm run pyth:update -- --num-items 1 --max-age 60    # BTC only, 60s max age');
    console.error('  npm run pyth:update -- --num-items 3 --max-age 120   # BTC, ETH, SHIB, 120s max age');
    console.error(`  npm run pyth:update -- -n ${PRICE_FEEDS.length} -m 30           # All feeds, 30s max age`);
    console.error('');
    console.error(`Available price feeds (${PRICE_FEEDS.length} total):`);
    PRICE_FEEDS.forEach((feed, i) => {
      console.error(`  ${i + 1}. ${feed.name}`);
    });
    process.exit(1);
  }

  // Parse num-items
  const numItems = parseInt(args[numItemsIndex + 1], 10);
  if (isNaN(numItems)) {
    console.error(`Error: --num-items must be a number, got: ${args[numItemsIndex + 1]}`);
    process.exit(1);
  }
  if (numItems < 1 || numItems > PRICE_FEEDS.length) {
    console.error(`Error: --num-items must be between 1 and ${PRICE_FEEDS.length}, got: ${numItems}`);
    process.exit(1);
  }

  // Parse max-age
  const maxAge = parseInt(args[maxAgeIndex + 1], 10);
  if (isNaN(maxAge)) {
    console.error(`Error: --max-age must be a number, got: ${args[maxAgeIndex + 1]}`);
    process.exit(1);
  }
  if (maxAge < 1) {
    console.error(`Error: --max-age must be at least 1 second, got: ${maxAge}`);
    process.exit(1);
  }

  return { numItems, maxAge };
}

// Pyth contract ABI (minimal interface)
const PYTH_ABI = [
  "function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 feeAmount)",
  "function updatePriceFeeds(bytes[] calldata updateData) external payable",
  "function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime))",
];

async function fetchHermesPrice(priceFeeds: typeof PRICE_FEEDS): Promise<string> {
  try {
    console.log(`[${new Date().toISOString()}] Fetching price data for ${priceFeeds.length} feed(s) from Hermes...`);

    // Build query parameters for all price IDs
    const queryParams = priceFeeds
      .map(feed => {
        const idWithoutPrefix = feed.id.startsWith("0x") ? feed.id.slice(2) : feed.id;
        return `ids%5B%5D=${idWithoutPrefix}`;
      })
      .join("&");

    const url = `${HERMES_URL}?${queryParams}`;

    console.log(`[${new Date().toISOString()}] Fetching: ${priceFeeds.map(f => f.name).join(", ")}`);

    // Use curl for reliable HTTP requests (works better than Node.js fetch in some environments)
    const curlCommand = `curl -s -X 'GET' '${url}' -H 'accept: application/json' --max-time 10`;
    const response = execSync(curlCommand, { encoding: 'utf-8' });

    const data = JSON.parse(response);

    // Extract the binary update data from the response
    if (!data.binary || !data.binary.data || !Array.isArray(data.binary.data)) {
      throw new Error("Invalid response format: missing binary.data array");
    }

    const encoding = data.binary.encoding;
    const binaryData = data.binary.data[0]; // Get first element from array

    console.log(`[${new Date().toISOString()}] Data encoding: ${encoding}`);
    console.log(`[${new Date().toISOString()}] Binary data length: ${binaryData.length} characters`);

    let updateData: string;

    // Handle different encodings
    if (encoding === 'hex') {
      // Data is already in hex format, just add 0x prefix
      updateData = `0x${binaryData}`;
    } else if (encoding === 'base64') {
      // Convert base64 to hex with 0x prefix
      updateData = `0x${Buffer.from(binaryData, 'base64').toString('hex')}`;
    } else {
      throw new Error(`Unsupported encoding: ${encoding}`);
    }

    console.log(`[${new Date().toISOString()}] Successfully fetched update data (${updateData.length} characters)`);
    return updateData;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching Hermes price:`, error);
    throw error;
  }
}

async function updatePythPrice(
  pythContract: ethers.Contract,
  priceFeeds: typeof PRICE_FEEDS,
  maxAge: number
): Promise<void> {
  try {
    // Step 1: Fetch update data from Hermes for selected price feeds
    const updateData = await fetchHermesPrice(priceFeeds);
    const updateDataArray = [updateData];

    // Step 2: Get the update fee
    console.log(`[${new Date().toISOString()}] Calling getUpdateFee...`);
    const feeAmount = await pythContract.getUpdateFee(updateDataArray);
    console.log(`[${new Date().toISOString()}] Update fee: ${ethers.formatEther(feeAmount)} CELO`);

    // Step 3: Update price feeds
    console.log(`[${new Date().toISOString()}] Calling updatePriceFeeds...`);
    const tx = await pythContract.updatePriceFeeds(updateDataArray, {
      value: feeAmount,
    });
    console.log(`[${new Date().toISOString()}] Transaction sent: ${tx.hash}`);
    console.log(`[${new Date().toISOString()}] View on CeloScan: https://celoscan.io/tx/${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[${new Date().toISOString()}] Transaction confirmed in block ${receipt.blockNumber}`);
    console.log("");

    // Step 4: Get and display all updated prices
    console.log(`[${new Date().toISOString()}] Reading updated prices...`);
    console.log("=".repeat(80));

    for (const feed of priceFeeds) {
      try {
        const priceData = await pythContract.getPriceNoOlderThan(feed.id, maxAge);

        // Calculate price: price * 10^expo
        const priceValue = Number(priceData.price);
        const exponent = Number(priceData.expo);
        const price = priceValue * Math.pow(10, exponent);
        const confidence = Number(priceData.conf) * Math.pow(10, exponent);

        console.log(`${feed.name}:`);
        console.log(`  Price: $${price.toFixed(8)} (±$${confidence.toFixed(8)})`);
        console.log(`  Raw: ${priceData.price.toString()} × 10^${exponent}`);
        console.log(`  Published: ${new Date(Number(priceData.publishTime) * 1000).toISOString()}`);
        console.log("");
      } catch (error) {
        console.log(`${feed.name}: Error reading price - ${error}`);
        console.log("");
      }
    }

    console.log("=".repeat(80));

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error updating Pyth price:`, error);
    throw error;
  }
}

async function main() {
  // Parse and validate command-line arguments
  const { numItems, maxAge } = parseArgs();

  // Validate environment variables
  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not set in environment variables");
  }

  // Select the first numItems price feeds
  const selectedFeeds = PRICE_FEEDS.slice(0, numItems);

  console.log("=".repeat(80));
  console.log("Pyth Price Updater");
  console.log("=".repeat(80));
  console.log(`RPC URL: ${RPC_URL}`);
  console.log(`Pyth Contract: ${PYTH_CONTRACT_ADDRESS}`);
  console.log(`Hermes URL: ${HERMES_URL}`);
  console.log(`Update Interval: ${UPDATE_INTERVAL / 1000} seconds`);
  console.log(`Max Age: ${maxAge} seconds`);
  console.log(`Price Feeds (${numItems}/${PRICE_FEEDS.length}):`);
  selectedFeeds.forEach((feed, i) => {
    console.log(`  ${i + 1}. ${feed.name}`);
  });
  console.log("=".repeat(80));

  // Set up provider and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`Wallet address: ${wallet.address}`);

  // Get wallet balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`Wallet balance: ${ethers.formatEther(balance)} CELO`);
  console.log("=".repeat(80));

  // Connect to Pyth contract
  const pythContract = new ethers.Contract(
    PYTH_CONTRACT_ADDRESS,
    PYTH_ABI,
    wallet
  );

  console.log(`[${new Date().toISOString()}] Starting price update loop...`);
  console.log("");

  // Run the update loop indefinitely
  while (true) {
    try {
      await updatePythPrice(pythContract, selectedFeeds, maxAge);
      console.log(`[${new Date().toISOString()}] Waiting ${UPDATE_INTERVAL / 1000} seconds until next update...`);
      console.log("-".repeat(80));
      console.log("");
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Update failed, will retry in ${UPDATE_INTERVAL / 1000} seconds`);
      console.log("");
    }

    // Wait for the configured interval
    await new Promise((resolve) => setTimeout(resolve, UPDATE_INTERVAL));
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log(`\n[${new Date().toISOString()}] Shutting down gracefully...`);
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
