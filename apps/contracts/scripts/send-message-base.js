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
    console.log("  node scripts/send-message-base.js --contract-address <address> --receiver-address <address> --use-entropy <true|false> --quote-only <true|false> [message]");
    console.log("\nExamples:");
    console.log("  node scripts/send-message-base.js --contract-address 0x123... --receiver-address 0x456... --use-entropy false --quote-only true \"Hello!\"");
    console.log("  node scripts/send-message-base.js --contract-address 0x123... --receiver-address 0x456... --use-entropy true --quote-only false");
    process.exit(1);
  }

  const SENDER_ADDRESS = args[contractAddressIndex + 1];
  if (!SENDER_ADDRESS || !SENDER_ADDRESS.startsWith('0x')) {
    console.error("❌ Error: Invalid contract address");
    process.exit(1);
  }

  // Parse --receiver-address flag
  const receiverAddressIndex = args.indexOf('--receiver-address');
  if (receiverAddressIndex === -1) {
    console.error("❌ Error: --receiver-address flag is required");
    console.log("\nUsage:");
    console.log("  node scripts/send-message-base.js --contract-address <address> --receiver-address <address> --use-entropy <true|false> --quote-only <true|false> [message]");
    console.log("\nExamples:");
    console.log("  node scripts/send-message-base.js --contract-address 0x123... --receiver-address 0x456... --use-entropy false --quote-only true \"Hello!\"");
    console.log("  node scripts/send-message-base.js --contract-address 0x123... --receiver-address 0x456... --use-entropy true --quote-only false");
    process.exit(1);
  }

  const RECEIVER_ADDRESS = args[receiverAddressIndex + 1];
  if (!RECEIVER_ADDRESS || !RECEIVER_ADDRESS.startsWith('0x')) {
    console.error("❌ Error: Invalid receiver address");
    process.exit(1);
  }

  // Parse --use-entropy flag
  const useEntropyIndex = args.indexOf('--use-entropy');
  if (useEntropyIndex === -1) {
    console.error("❌ Error: --use-entropy flag is required");
    console.log("\nUsage:");
    console.log("  node scripts/send-message-base.js --contract-address <address> --receiver-address <address> --use-entropy <true|false> --quote-only <true|false> [message]");
    console.log("\nExamples:");
    console.log("  node scripts/send-message-base.js --contract-address 0x123... --receiver-address 0x456... --use-entropy false --quote-only true \"Hello!\"");
    console.log("  node scripts/send-message-base.js --contract-address 0x123... --receiver-address 0x456... --use-entropy true --quote-only false");
    process.exit(1);
  }

  const useEntropyValue = args[useEntropyIndex + 1];
  if (useEntropyValue !== 'true' && useEntropyValue !== 'false') {
    console.error("❌ Error: --use-entropy must be 'true' or 'false'");
    process.exit(1);
  }
  const useEntropy = useEntropyValue === 'true';

  // Parse --quote-only flag
  const quoteOnlyIndex = args.indexOf('--quote-only');
  if (quoteOnlyIndex === -1) {
    console.error("❌ Error: --quote-only flag is required");
    console.log("\nUsage:");
    console.log("  node scripts/send-message-base.js --contract-address <address> --receiver-address <address> --use-entropy <true|false> --quote-only <true|false> [message]");
    console.log("\nExamples:");
    console.log("  node scripts/send-message-base.js --contract-address 0x123... --receiver-address 0x456... --use-entropy false --quote-only true \"Hello!\"");
    console.log("  node scripts/send-message-base.js --contract-address 0x123... --receiver-address 0x456... --use-entropy true --quote-only false");
    process.exit(1);
  }

  const quoteOnlyValue = args[quoteOnlyIndex + 1];
  if (quoteOnlyValue !== 'true' && quoteOnlyValue !== 'false') {
    console.error("❌ Error: --quote-only must be 'true' or 'false'");
    process.exit(1);
  }
  const quoteOnly = quoteOnlyValue === 'true';

  // Get message (if provided, exclude flag arguments)
  const messageArgs = args.filter((arg, index) =>
    arg !== '--contract-address' && index !== contractAddressIndex + 1 &&
    arg !== '--receiver-address' && index !== receiverAddressIndex + 1 &&
    arg !== '--use-entropy' && index !== useEntropyIndex + 1 &&
    arg !== '--quote-only' && index !== quoteOnlyIndex + 1
  );
  const message = messageArgs[0] || "Hello from Base to Celo!";

  // Configuration
  const CELO_DOMAIN_ID = 42220;
  const BASE_RPC = "https://mainnet.base.org";

  if (!process.env.PRIVATE_KEY) {
    console.error("PRIVATE_KEY not found in .env file");
    process.exit(1);
  }

  // Connect to Base
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log(`\n📨 ${quoteOnly ? 'Getting Quote for' : 'Sending'} Cross-Chain ${useEntropy ? 'Entropy' : 'Message'}`);
  console.log("================================");
  console.log("Mode:", useEntropy ? "Entropy (Random Number)" : "Regular Message");
  console.log("Action:", quoteOnly ? "Quote Only" : "Quote + Execute");
  console.log("From (Base):", SENDER_ADDRESS);
  console.log("To (Celo):", RECEIVER_ADDRESS);
  if (!useEntropy) {
    console.log("Message:", message);
  }
  console.log("Sender wallet:", wallet.address);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Load contract ABI
  const contractArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/HyperlaneSource.sol/HyperlaneBase.json"),
      "utf8"
    )
  );

  // Connect to HyperlaneBase contract
  const senderContract = new ethers.Contract(
    SENDER_ADDRESS,
    contractArtifact.abi,
    wallet
  );

  let quote;

  if (useEntropy) {
    // Get quote for entropy relay
    console.log("🔍 Getting quote for entropy relay cost...");
    quote = await senderContract.quoteEntropyRelay(
      CELO_DOMAIN_ID,
      RECEIVER_ADDRESS
    );

    const ethAmount = ethers.formatEther(quote);
    const usdAmount = (parseFloat(ethAmount) * 3000).toFixed(4);
    console.log("Quote:", ethAmount, "ETH", `($${usdAmount})`);
    console.log("Quote (wei):", quote.toString());
    console.log("(Includes: Entropy fee + Hyperlane gas)\n");

    if (quoteOnly) {
      console.log("✅ Quote retrieved successfully!");
      console.log("Run with --quote-only false to execute the transaction\n");
      return;
    }

    // Check if we have enough balance
    if (balance < quote) {
      console.error("❌ Insufficient balance! Need", ethers.formatEther(quote), "ETH");
      process.exit(1);
    }

    // Request and relay entropy
    console.log("🎲 Requesting entropy and scheduling relay...");
    const tx = await senderContract.requestAndRelayEntropy(
      CELO_DOMAIN_ID,
      RECEIVER_ADDRESS,
      { value: quote }
    );

    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...\n");

    const receipt = await tx.wait();

    console.log("✅ Entropy request sent successfully!");
    console.log("================================");
    console.log("Transaction:", `https://basescan.org/tx/${tx.hash}`);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("\n⏳ Pyth will call back with random number in ~30 seconds");
    console.log("⏳ Then the random number will be sent to Celo via Hyperlane");
    console.log("Check receiver on Celo:", `https://celoscan.io/address/${RECEIVER_ADDRESS}#events\n`);
  } else {
    // Get quote for the message
    console.log("🔍 Getting quote for message cost...");
    quote = await senderContract.quoteSendMessage(
      CELO_DOMAIN_ID,
      RECEIVER_ADDRESS,
      message
    );

    const ethAmount = ethers.formatEther(quote);
    const usdAmount = (parseFloat(ethAmount) * 3000).toFixed(4);
    console.log("Quote:", ethAmount, "ETH", `($${usdAmount})`);
    console.log("Quote (wei):", quote.toString(), "\n");

    if (quoteOnly) {
      console.log("✅ Quote retrieved successfully!");
      console.log("Run with --quote-only false to execute the transaction\n");
      return;
    }

    // Check if we have enough balance
    if (balance < quote) {
      console.error("❌ Insufficient balance! Need", ethers.formatEther(quote), "ETH");
      process.exit(1);
    }

    // Send the message
    console.log("📤 Sending message...");
    const tx = await senderContract.sendMessage(
      CELO_DOMAIN_ID,
      RECEIVER_ADDRESS,
      message,
      { value: quote }
    );

    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...\n");

    const receipt = await tx.wait();

    console.log("✅ Message sent successfully!");
    console.log("================================");
    console.log("Transaction:", `https://basescan.org/tx/${tx.hash}`);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("\n⏳ Message should arrive on Celo in ~5-10 minutes");
    console.log("Check receiver on Celo:", `https://celoscan.io/address/${RECEIVER_ADDRESS}#events`);
    console.log("\nTo check if message was received, read lastMessage from receiver contract\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
