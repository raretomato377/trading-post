const { Wallet } = require("ethers");

// Generate a new random wallet
const wallet = Wallet.createRandom();

console.log("\n🔐 NEW WALLET GENERATED");
console.log("================================");
console.log("Address:", wallet.address);
console.log("Private Key:", wallet.privateKey);
console.log("================================\n");
console.log("⚠️  SAVE THIS INFORMATION SECURELY!");
console.log("⚠️  This wallet is for TESTNET ONLY - never send real funds to it\n");
console.log("Next steps:");
console.log("1. Add private key to .env file (without 0x prefix)");
console.log("2. Get testnet CELO from https://faucet.celo.org using the address above");
console.log("3. Run: node scripts/deploy-simple.js celoSepolia\n");
