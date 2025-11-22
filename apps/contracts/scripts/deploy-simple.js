import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function main() {
  // Network configuration
  const networks = {
    celoSepolia: {
      rpc: "https://11142220.rpc.thirdweb.com",
      chainId: 11142220,
      explorer: "https://celo-sepolia.blockscout.com"
    },
    alfajores: {
      rpc: "https://alfajores-forno.celo-testnet.org",
      chainId: 44787,
      explorer: "https://alfajores.celoscan.io"
    },
    celo: {
      rpc: "https://forno.celo.org",
      chainId: 42220,
      explorer: "https://celoscan.io"
    }
  };

  const networkName = process.argv[2] || "celoSepolia";
  const network = networks[networkName];

  if (!network) {
    console.error(`Unknown network: ${networkName}`);
    console.log("Available networks:", Object.keys(networks).join(", "));
    process.exit(1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("PRIVATE_KEY not found in .env file");
    process.exit(1);
  }

  // Connect to network
  const provider = new ethers.JsonRpcProvider(network.rpc);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log(`\nDeploying to ${networkName}...`);
  console.log("Deployer address:", wallet.address);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "tokens\n");

  // Get the current timestamp and add 1 year for unlock time
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = currentTimestampInSeconds + 365 * 24 * 60 * 60;

  const lockedAmount = ethers.parseEther("0.001");

  console.log("Unlock time:", new Date(unlockTime * 1000).toLocaleString());
  console.log("Locked amount:", ethers.formatEther(lockedAmount), "tokens\n");

  // Read compiled contract
  const lockArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/Lock.sol/Lock.json"),
      "utf8"
    )
  );

  // Deploy contract
  const factory = new ethers.ContractFactory(
    lockArtifact.abi,
    lockArtifact.bytecode,
    wallet
  );

  console.log("Deploying Lock contract...");
  const lock = await factory.deploy(unlockTime, { value: lockedAmount });

  console.log("Waiting for deployment...");
  await lock.waitForDeployment();

  const address = await lock.getAddress();

  console.log(`\n✅ Lock contract deployed to: ${address}`);
  console.log(`   View on Explorer: ${network.explorer}/address/${address}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
