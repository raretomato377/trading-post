require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  // Configuration
  const RECEIVER_ADDRESS = "0x8Ea7eBc246A8358f8381C89C27Af14074A437BCC"; // Celo
  const CELO_RPC = "https://forno.celo.org";

  // Connect to Celo
  const provider = new ethers.JsonRpcProvider(CELO_RPC);

  console.log("\n📬 Checking Receiver on Celo");
  console.log("================================");
  console.log("Receiver address:", RECEIVER_ADDRESS);
  console.log("Network: Celo Mainnet\n");

  // Load contract ABI
  const contractArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/HyperlaneCelo.sol/HyperlaneCelo.json"),
      "utf8"
    )
  );

  // Connect to HyperlaneCelo contract (read-only)
  const receiverContract = new ethers.Contract(
    RECEIVER_ADDRESS,
    contractArtifact.abi,
    provider
  );

  try {
    // Read the last received message
    const lastMessage = await receiverContract.lastMessage();
    const lastSender = await receiverContract.lastSender();
    const lastOriginDomain = await receiverContract.lastOriginDomain();

    console.log("Last Message Received:");
    console.log("----------------------");
    console.log("Message:", lastMessage || "(no message yet)");
    console.log("Sender:", lastSender);
    console.log("Origin Domain:", lastOriginDomain.toString(), lastOriginDomain == 8453 ? "(Base)" : "");
    console.log("\nView on Celoscan:", `https://celoscan.io/address/${RECEIVER_ADDRESS}#events\n`);
  } catch (error) {
    console.error("Error reading contract:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
