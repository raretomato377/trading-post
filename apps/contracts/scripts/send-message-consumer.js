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
    console.log("  node scripts/send-message-consumer.js --contract-address <address> --quote-only <true|false>");
    console.log("\nExample:");
    console.log("  node scripts/send-message-consumer.js --contract-address 0x... --quote-only true");
    console.log("  node scripts/send-message-consumer.js --contract-address 0x... --quote-only false");
    process.exit(1);
  }

  const CONTRACT_ADDRESS = args[contractAddressIndex + 1];
  if (!CONTRACT_ADDRESS || !CONTRACT_ADDRESS.startsWith('0x')) {
    console.error("❌ Error: Invalid contract address");
    process.exit(1);
  }

  // Parse --quote-only flag (mandatory)
  const quoteOnlyIndex = args.indexOf('--quote-only');
  if (quoteOnlyIndex === -1) {
    console.error("❌ Error: --quote-only flag is required");
    console.log("\nUsage:");
    console.log("  node scripts/send-message-consumer.js --contract-address <address> --quote-only <true|false>");
    console.log("\nExample:");
    console.log("  node scripts/send-message-consumer.js --contract-address 0x... --quote-only true");
    console.log("  node scripts/send-message-consumer.js --contract-address 0x... --quote-only false");
    process.exit(1);
  }

  const quoteOnlyValue = args[quoteOnlyIndex + 1];
  if (quoteOnlyValue !== 'true' && quoteOnlyValue !== 'false') {
    console.error("❌ Error: --quote-only must be 'true' or 'false'");
    process.exit(1);
  }

  const QUOTE_ONLY = quoteOnlyValue === 'true';

  // Configuration
  const CELO_RPC = "https://forno.celo.org";

  // Connect to Celo
  const provider = new ethers.JsonRpcProvider(CELO_RPC);

  // If not quote-only, we need a wallet
  let signer;
  if (!QUOTE_ONLY) {
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) {
      console.error("❌ Error: PRIVATE_KEY not found in environment variables");
      console.error("Required for transaction execution (--quote-only false)");
      process.exit(1);
    }
    signer = new ethers.Wallet(PRIVATE_KEY, provider);
  }

  console.log(`\n📊 ${QUOTE_ONLY ? 'Getting Quote from' : 'Executing Transaction on'} ExampleEntropyConsumer Contract`);
  console.log("================================");
  console.log("Contract (Celo):", CONTRACT_ADDRESS);
  console.log("Mode:", QUOTE_ONLY ? "Read-only (quote only)" : "Transaction (request randomness)");
  if (!QUOTE_ONLY) {
    console.log("Wallet:", signer.address);
  }
  console.log();

  // Load contract ABIs
  const consumerArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/ExampleEntropyConsumer.sol/ExampleEntropyConsumer.json"),
      "utf8"
    )
  );

  const hyperlaneCeloArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/HyperlaneCelo.sol/HyperlaneCelo.json"),
      "utf8"
    )
  );

  // Connect to ExampleEntropyConsumer contract
  const consumerContract = new ethers.Contract(
    CONTRACT_ADDRESS,
    consumerArtifact.abi,
    QUOTE_ONLY ? provider : signer
  );

  try {
    // Get the HyperlaneCelo address from the consumer contract
    console.log("🔍 Reading contract configuration...");
    const hyperlaneCeloAddress = await consumerContract.hyperlaneCelo();
    console.log("HyperlaneCelo Contract:", hyperlaneCeloAddress);

    // Connect to HyperlaneCelo contract (read-only)
    const hyperlaneCeloContract = new ethers.Contract(
      hyperlaneCeloAddress,
      hyperlaneCeloArtifact.abi,
      provider
    );

    // Get quote for requesting entropy
    console.log("\n🔍 Getting quote for entropy request cost...");
    const quote = await hyperlaneCeloContract.quoteRequestEntropy();

    const celoAmount = ethers.formatEther(quote);
    const usdAmount = (parseFloat(celoAmount) * 0.70).toFixed(4); // Rough CELO price estimate
    console.log("Quote:", celoAmount, "CELO", `($${usdAmount})`);
    console.log("Quote (wei):", quote.toString());
    console.log("(Cost to send entropy request from Celo to Base via Hyperlane)\n");

    if (QUOTE_ONLY) {
      // Quote-only mode: read current state
      console.log("📖 Reading current entropy state...");
      const requestCount = await consumerContract.entropyRequestCount();
      const lastRandomNumber = await consumerContract.lastRandomNumber();
      const lastSequenceNumber = await consumerContract.lastSequenceNumber();

      console.log("Total Entropy Requests:", requestCount.toString());
      console.log("Last Random Number:", lastRandomNumber);
      console.log("Last Sequence Number:", lastSequenceNumber.toString());

      if (lastRandomNumber !== ethers.ZeroHash) {
        console.log("\n🎲 Testing random number generation...");

        // Get a random number in range 1-100
        try {
          const randomInRange = await consumerContract.getRandomInRange(100);
          console.log("Random number (0-99):", randomInRange.toString());
        } catch (error) {
          console.log("Random in range not available (no entropy yet)");
        }

        // Get multiple random numbers
        try {
          const multipleRandom = await consumerContract.getMultipleRandom(5, 100);
          console.log("Multiple random numbers (0-99):", multipleRandom.map(n => n.toString()).join(", "));
        } catch (error) {
          console.log("Multiple random not available (no entropy yet)");
        }
      } else {
        console.log("\n⚠️  No entropy received yet. Call requestRandomness() first!");
      }

      console.log("\n✅ Quote retrieved successfully!");
    } else {
      // Transaction mode: request randomness
      console.log("💰 Checking contract balance...");
      const balance = await provider.getBalance(CONTRACT_ADDRESS);
      const balanceCelo = ethers.formatEther(balance);
      console.log("Contract Balance:", balanceCelo, "CELO");

      console.log("\n💰 Checking wallet balance...");
      const walletBalance = await provider.getBalance(signer.address);
      const walletBalanceCelo = ethers.formatEther(walletBalance);
      console.log("Wallet Balance:", walletBalanceCelo, "CELO");

      if (walletBalance < quote) {
        console.error("\n❌ Error: Insufficient wallet balance");
        console.error(`Required: ${celoAmount} CELO`);
        console.error(`Available: ${walletBalanceCelo} CELO`);
        process.exit(1);
      }

      console.log("\n🚀 Sending transaction to requestRandomness()...");
      console.log("Sending:", celoAmount, "CELO");
      console.log("(This will trigger the cross-chain entropy request)\n");

      const tx = await consumerContract.requestRandomness({
        value: quote
      });

      console.log("Transaction Hash:", tx.hash);
      console.log("⏳ Waiting for confirmation...");

      const receipt = await tx.wait();

      console.log("\n✅ Transaction confirmed!");
      console.log("Block Number:", receipt.blockNumber);
      console.log("Gas Used:", receipt.gasUsed.toString());

      // Parse EntropyRequested event
      const entropyRequestedEvent = receipt.logs
        .map(log => {
          try {
            return consumerContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(event => event && event.name === "EntropyRequested");

      if (entropyRequestedEvent) {
        console.log("\n📨 Entropy Request Event:");
        console.log("Request Number:", entropyRequestedEvent.args.requestNumber.toString());
      }

      // Read updated state
      console.log("\n📖 Reading updated state...");
      const requestCount = await consumerContract.entropyRequestCount();
      console.log("Total Entropy Requests:", requestCount.toString());

      console.log("\n🎉 Randomness request sent successfully!");
      console.log("The entropy will be requested from Base and delivered back via Hyperlane.");
      console.log("\n⏳ Next steps:");
      console.log("1. Wait ~1-2 minutes for Pyth to generate entropy on Base");
      console.log("2. Wait for Hyperlane to deliver the entropy back to Celo");
      console.log("3. The receiveEntropy() callback will be called automatically");
      console.log("4. Check the entropy with: --quote-only true");
    }
  } catch (error) {
    console.error("\n❌ Error:");
    console.error(error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
