/**
 * Utility script to check if on-chain contract bytecode matches compiled bytecode.
 * Useful for debugging deployment issues or verifying contract updates.
 * 
 * Usage:
 *   npm run check:bytecode <CONTRACT_ADDRESS> [network]
 *   ts-node scripts/check-contract-bytecode.ts <CONTRACT_ADDRESS> [network]
 * 
 * Example:
 *   npm run check:bytecode 0x1a44Db17D284F5462111098A1e499Fc47c581383 celo
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { createPublicClient, http } from "viem";
import { celo, celoAlfajores } from "viem/chains";

config();

async function main() {
  const contractAddress = process.argv[2];
  const networkName = process.argv[3] || "celo";

  if (!contractAddress) {
    console.error("Usage: ts-node scripts/check-contract-bytecode.ts <CONTRACT_ADDRESS> [network]");
    console.error("Example: ts-node scripts/check-contract-bytecode.ts 0x1a44Db17D284F5462111098A1e499Fc47c581383 celo");
    process.exit(1);
  }

  const chain = networkName === "celo" ? celo : networkName === "alfajores" ? celoAlfajores : null;
  if (!chain) {
    console.error(`Unknown network: ${networkName}`);
    process.exit(1);
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  console.log(`\n🔍 Checking contract bytecode on ${networkName}...`);
  console.log(`   Address: ${contractAddress}\n`);

  try {
    // Get deployed bytecode
    const deployedBytecode = await publicClient.getBytecode({
      address: contractAddress as `0x${string}`,
    });

    if (!deployedBytecode || deployedBytecode === "0x") {
      console.error("❌ No bytecode found at this address. Contract may not be deployed.");
      process.exit(1);
    }

    console.log(`✅ Contract bytecode found on-chain`);
    console.log(`   Bytecode length: ${deployedBytecode.length} characters`);
    console.log(`   Bytecode hash (first 20 chars): ${deployedBytecode.substring(0, 20)}...`);

    // Get compiled bytecode
    const contractsRoot = path.resolve(__dirname, "..");
    const artifactsPath = path.join(
      contractsRoot,
      "artifacts",
      "contracts",
      "TradingCardGame.sol",
      "TradingCardGame.json"
    );

    if (fs.existsSync(artifactsPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
      const compiledBytecode = artifact.deployedBytecode?.object || artifact.deployedBytecode;

      if (compiledBytecode) {
        // Remove "0x" prefix and compare
        const deployed = deployedBytecode.replace(/^0x/, "").toLowerCase();
        const compiled = compiledBytecode.replace(/^0x/, "").toLowerCase();

        console.log(`\n📦 Compiled bytecode:`);
        console.log(`   Bytecode length: ${compiled.length} characters`);
        console.log(`   Bytecode hash (first 20 chars): ${compiled.substring(0, 20)}...`);

        if (deployed === compiled) {
          console.log(`\n✅ MATCH! On-chain bytecode matches compiled bytecode.`);
          console.log(`   The contract on-chain is the NEW version.`);
          console.log(`   If explorer shows old code, it's cached - try:`);
          console.log(`   1. Clear browser cache`);
          console.log(`   2. Wait a few minutes`);
          console.log(`   3. Re-verify the contract to update explorer`);
        } else {
          console.log(`\n⚠️  MISMATCH! On-chain bytecode is DIFFERENT from compiled bytecode.`);
          console.log(`   This means:`);
          console.log(`   - The contract on-chain is the OLD version`);
          console.log(`   - You need to deploy the new contract to a NEW address`);
          console.log(`   - Or the contract wasn't properly updated`);
        }
      } else {
        console.log(`\n⚠️  Could not read compiled bytecode from artifacts`);
      }
    } else {
      console.log(`\n⚠️  Artifacts file not found. Run 'npm run compile' first.`);
    }
  } catch (error) {
    console.error(`\n❌ Error checking bytecode:`, error);
    process.exit(1);
  }

  console.log(`\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

