require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  // Configuration
  const SENDER_ADDRESS = "0x8Ea7eBc246A8358f8381C89C27Af14074A437BCC"; // Base
  const RECEIVER_ADDRESS = "0x8Ea7eBc246A8358f8381C89C27Af14074A437BCC"; // Celo
  const CELO_DOMAIN_ID = 42220;
  const BASE_RPC = "https://mainnet.base.org";

  const message = process.argv[2] || "Hello from Base to Celo!";

  if (!process.env.PRIVATE_KEY) {
    console.error("PRIVATE_KEY not found in .env file");
    process.exit(1);
  }

  // Connect to Base
  const provider = new ethers.JsonRpcProvider(BASE_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("\n📨 Sending Cross-Chain Message");
  console.log("================================");
  console.log("From (Base):", SENDER_ADDRESS);
  console.log("To (Celo):", RECEIVER_ADDRESS);
  console.log("Message:", message);
  console.log("Sender wallet:", wallet.address);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // Load contract ABI
  const contractArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/HyperlaneSource.sol/HyperlaneSender.json"),
      "utf8"
    )
  );

  // Connect to HyperlaneSender contract
  const senderContract = new ethers.Contract(
    SENDER_ADDRESS,
    contractArtifact.abi,
    wallet
  );

  // Step 1: Get quote for the message
  console.log("🔍 Getting quote for message cost...");
  const quote = await senderContract.quoteSendMessage(
    CELO_DOMAIN_ID,
    RECEIVER_ADDRESS,
    message
  );

  console.log("Quote:", ethers.formatEther(quote), "ETH");
  console.log("Quote (wei):", quote.toString(), "\n");

  // Check if we have enough balance
  if (balance < quote) {
    console.error("❌ Insufficient balance! Need", ethers.formatEther(quote), "ETH");
    process.exit(1);
  }

  // Step 2: Send the message
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
