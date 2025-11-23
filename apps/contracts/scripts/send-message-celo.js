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
    console.log("  node scripts/send-message-celo.js --contract-address <address> --quote-only <true|false>");
    console.log("\nExample:");
    console.log("  node scripts/send-message-celo.js --contract-address 0x8Ea7eBc246A8358f8381C89C27Af14074A437BCC --quote-only true");
    console.log("  node scripts/send-message-celo.js --contract-address 0x8Ea7eBc246A8358f8381C89C27Af14074A437BCC --quote-only false");
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
    console.log("  node scripts/send-message-celo.js --contract-address <address> --quote-only <true|false>");
    console.log("\nExample:");
    console.log("  node scripts/send-message-celo.js --contract-address 0x8Ea7eBc246A8358f8381C89C27Af14074A437BCC --quote-only true");
    console.log("  node scripts/send-message-celo.js --contract-address 0x8Ea7eBc246A8358f8381C89C27Af14074A437BCC --quote-only false");
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
  const PAYMENT_AMOUNT = ethers.parseEther("1.2"); // 1.2 CELO

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

  console.log(`\n📊 ${QUOTE_ONLY ? 'Getting Quote from' : 'Executing Transaction on'} HyperlaneCelo Contract`);
  console.log("================================");
  console.log("Contract (Celo):", CONTRACT_ADDRESS);
  console.log("Mode:", QUOTE_ONLY ? "Read-only (quote only)" : "Transaction (execute requestEntropy)");
  if (!QUOTE_ONLY) {
    console.log("Wallet:", signer.address);
    console.log("Payment Amount:", ethers.formatEther(PAYMENT_AMOUNT), "CELO");
  }
  console.log();

  // Load contract ABI
  const contractArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/HyperlaneCelo.sol/HyperlaneCelo.json"),
      "utf8"
    )
  );

  // Connect to HyperlaneCelo contract
  const celoContract = new ethers.Contract(
    CONTRACT_ADDRESS,
    contractArtifact.abi,
    QUOTE_ONLY ? provider : signer
  );

  try {
    // Get quote for requesting entropy (always needed)
    console.log("🔍 Getting quote for entropy request cost...");
    const quote = await celoContract.quoteRequestEntropy();

    const ethAmount = ethers.formatEther(quote);
    const usdAmount = (parseFloat(ethAmount) * 700).toFixed(4); // Rough CELO price estimate
    console.log("Quote:", ethAmount, "CELO", `($${usdAmount})`);
    console.log("Quote (wei):", quote.toString());
    console.log("(Cost to send entropy request from Celo to Base via Hyperlane)\n");

    if (QUOTE_ONLY) {
      // Quote-only mode: just read configuration and data
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
    } else {
      // Transaction mode: execute requestEntropy
      console.log("💰 Checking wallet balance...");
      const balance = await provider.getBalance(signer.address);
      const balanceEth = ethers.formatEther(balance);
      console.log("Wallet Balance:", balanceEth, "CELO");

      if (balance < PAYMENT_AMOUNT) {
        console.error("\n❌ Error: Insufficient balance");
        console.error(`Required: ${ethers.formatEther(PAYMENT_AMOUNT)} CELO`);
        console.error(`Available: ${balanceEth} CELO`);
        process.exit(1);
      }

      console.log("\n🚀 Sending transaction to requestEntropy()...");
      console.log("Sending:", ethers.formatEther(PAYMENT_AMOUNT), "CELO");
      console.log("(Quote requires:", ethAmount, "CELO, extra covers gas buffer)\n");

      const tx = await celoContract.requestEntropy({
        value: PAYMENT_AMOUNT
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
            return celoContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(event => event && event.name === "EntropyRequested");

      if (entropyRequestedEvent) {
        console.log("\n📨 Entropy Request Event:");
        console.log("Requester:", entropyRequestedEvent.args.requester);
        console.log("Message ID:", entropyRequestedEvent.args.messageId);
      }

      console.log("\n🎉 Entropy request sent successfully!");
      console.log("The entropy will be sent from Base to Celo via Hyperlane.");
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
