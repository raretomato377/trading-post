require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  // Parse --contract-address flag
  const contractAddressIndex = args.indexOf('--contract-address');
  if (contractAddressIndex === -1) {
    console.error("❌ Error: --contract-address flag is required");
    console.log("\nUsage:");
    console.log("  node scripts/send-message-celo.js --contract-address <address>");
    console.log("\nExample:");
    console.log("  node scripts/send-message-celo.js --contract-address 0x8Ea7eBc246A8358f8381C89C27Af14074A437BCC");
    process.exit(1);
  }

  const CONTRACT_ADDRESS = args[contractAddressIndex + 1];
  if (!CONTRACT_ADDRESS || !CONTRACT_ADDRESS.startsWith('0x')) {
    console.error("❌ Error: Invalid contract address");
    process.exit(1);
  }

  // Configuration
  const CELO_RPC = "https://forno.celo.org";

  // Connect to Celo (read-only, no wallet needed)
  const provider = new ethers.JsonRpcProvider(CELO_RPC);

  console.log(`\n📊 Getting Quote from HyperlaneCelo Contract`);
  console.log("================================");
  console.log("Contract (Celo):", CONTRACT_ADDRESS);
  console.log("Mode: Read-only (no transaction)\n");

  // Load contract ABI
  const contractArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/HyperlaneCelo.sol/HyperlaneCelo.json"),
      "utf8"
    )
  );

  // Connect to HyperlaneCelo contract (read-only)
  const celoContract = new ethers.Contract(
    CONTRACT_ADDRESS,
    contractArtifact.abi,
    provider
  );

  try {
    // Get quote for requesting entropy
    console.log("🔍 Getting quote for entropy request cost...");
    const quote = await celoContract.quoteRequestEntropy();

    const ethAmount = ethers.formatEther(quote);
    const usdAmount = (parseFloat(ethAmount) * 700).toFixed(4); // Rough CELO price estimate
    console.log("Quote:", ethAmount, "CELO", `($${usdAmount})`);
    console.log("Quote (wei):", quote.toString());
    console.log("(Cost to send entropy request from Celo to Base via Hyperlane)\n");

    // Read current source configuration
    console.log("📖 Reading contract configuration...");
    const sourceDomain = await celoContract.sourceDomain();
    const sourceContract = await celoContract.sourceContract();
    const allowedRequester = await celoContract.allowedRequester();

    console.log("Source Domain (Base):", sourceDomain.toString());
    console.log("Source Contract Address:", sourceContract);
    console.log("Allowed Requester:", allowedRequester);

    // Try to read last received entropy data
    console.log("\n📖 Reading last received entropy data...");
    try {
      const lastEntropyData = await celoContract.lastEntropyData();
      const lastSender = await celoContract.lastSender();
      const lastOriginDomain = await celoContract.lastOriginDomain();

      console.log("Last Random Number:", lastEntropyData.randomNumber);
      console.log("Entropy Length:", lastEntropyData.entropyLength.toString());
      console.log("Sequence Number:", lastEntropyData.sequenceNumber.toString());
      console.log("Source Contract:", lastEntropyData.sourceContract);
      console.log("Last Sender:", lastSender);
      console.log("Last Origin Domain:", lastOriginDomain.toString());
    } catch (error) {
      console.log("No entropy data received yet");
    }

    console.log("\n✅ Quote retrieved successfully!");
  } catch (error) {
    console.error("\n❌ Error reading from contract:");
    console.error(error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
