import dotenv from "dotenv";
import { Wallet } from "ethers";

dotenv.config();

if (!process.env.PRIVATE_KEY) {
  console.error("Error: PRIVATE_KEY not found in .env file");
  process.exit(1);
}

// Create wallet from private key
const wallet = new Wallet(process.env.PRIVATE_KEY);

console.log("\n📋 Wallet Information:");
console.log("================================");
console.log("Private Key:", process.env.PRIVATE_KEY);
console.log("Address (Public):", wallet.address);
console.log("================================\n");
console.log("The address is automatically derived from the private key!");
console.log("You only need to store the private key - the address can always be calculated.\n");
