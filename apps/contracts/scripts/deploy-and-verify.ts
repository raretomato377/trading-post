/**
 * Deployment and verification script for TradingCardGame contract.
 * 
 * Features:
 * - Automatic code change detection (deploys to new address if code changed)
 * - Automatic contract verification on block explorer
 * - Sourcify verification support
 * - Clear deployment information and next steps
 * 
 * Usage:
 *   npm run deploy:game:verify:<network>
 *   ts-node scripts/deploy-and-verify.ts <network> [--reset]
 * 
 * Examples:
 *   npm run deploy:game:verify:celo
 *   ts-node scripts/deploy-and-verify.ts alfajores --reset
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

// Load environment variables
config();

// Pyth contract addresses for different networks
const PYTH_CONTRACTS: Record<string, string> = {
  alfajores: "0x74f09cb3c7e2A01865f424FD14F6dc9A14E3e94E",
  celo: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  sepolia: "0x0000000000000000000000000000000000000000", // TODO: Update when available
};

// Chain ID to network name mapping
const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  42220: "celo",
  44787: "alfajores",
  11142220: "sepolia",
  31337: "localhost",
};

interface NetworkConfig {
  chainId: number;
  networkName: string;
  pythAddress: string;
}

function getNetworkConfig(networkName: string): NetworkConfig {
  const chainIds: Record<string, number> = {
    celo: 42220,
    alfajores: 44787,
    sepolia: 11142220,
    localhost: 31337,
  };

  const chainId = chainIds[networkName];
  if (!chainId) {
    throw new Error(`Unknown network: ${networkName}`);
  }

  const pythAddress = PYTH_CONTRACTS[networkName];
  if (!pythAddress || pythAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Pyth address not configured for network: ${networkName}`);
  }

  return { chainId, networkName, pythAddress };
}

function getDeployedAddress(chainId: number): string | null {
  // __dirname points to the scripts directory, so go up one level to contracts root
  const contractsRoot = path.resolve(__dirname, "..");
  const deploymentPath = path.join(
    contractsRoot,
    "ignition",
    "deployments",
    `chain-${chainId}`,
    "deployed_addresses.json"
  );

  if (!fs.existsSync(deploymentPath)) {
    return null;
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  return deploymentData["TradingCardGameModule#TradingCardGame"] || null;
}

/**
 * Check if the compiled bytecode differs from what's deployed on-chain
 * Returns true if code has changed and needs a new deployment
 */
async function checkIfCodeChanged(
  deployedAddress: string,
  networkName: string,
  contractsRoot: string
): Promise<boolean> {
  try {
    // Get compiled bytecode
    const artifactsPath = path.join(
      contractsRoot,
      "artifacts",
      "contracts",
      "TradingCardGame.sol",
      "TradingCardGame.json"
    );

    if (!fs.existsSync(artifactsPath)) {
      console.log("   ⚠️  Artifacts not found - will compile first");
      return true; // Assume changed if we can't check
    }

    const artifact = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
    const compiledBytecode = artifact.deployedBytecode?.object || artifact.deployedBytecode;
    
    if (!compiledBytecode) {
      return true; // Can't compare, assume changed
    }

    // Get on-chain bytecode using a simple HTTP call to the RPC
    const rpcUrl = networkName === "celo" 
      ? "https://forno.celo.org"
      : networkName === "alfajores"
      ? "https://alfajores-forno.celo-testnet.org"
      : "https://11142220.rpc.thirdweb.com";

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getCode",
        params: [deployedAddress, "latest"],
        id: 1,
      }),
    });

    const data = await response.json();
    const onChainBytecode = data.result || "0x";

    if (onChainBytecode === "0x" || onChainBytecode === null) {
      console.log("   ℹ️  No contract found at address - will deploy");
      return true;
    }

    // Compare bytecode (remove 0x prefix and compare)
    const compiled = compiledBytecode.replace(/^0x/, "").toLowerCase();
    const deployed = onChainBytecode.replace(/^0x/, "").toLowerCase();

    if (compiled !== deployed) {
      console.log("   🔍 Code has changed - will deploy to new address");
      return true;
    }

    console.log("   ✅ Code matches on-chain - no changes detected");
    return false;
  } catch (error) {
    // If we can't check, assume changed to be safe
    console.log(`   ⚠️  Could not verify bytecode (${error}), will deploy to be safe`);
    return true;
  }
}

async function main() {
  const networkName = process.argv[2] || "alfajores";
  const shouldReset = process.argv[3] === "--reset" || process.argv[3] === "-r";
  const networkConfig = getNetworkConfig(networkName);

  console.log(`\n🚀 Deploying TradingCardGame to ${networkName}...`);
  console.log(`   Chain ID: ${networkConfig.chainId}`);
  console.log(`   Pyth Address: ${networkConfig.pythAddress}\n`);

  const contractsRoot = path.resolve(__dirname, "..");
  
  // Check if code has changed and auto-reset if needed
  const previousAddress = getDeployedAddress(networkConfig.chainId);
  let autoReset = shouldReset;
  
  if (previousAddress && !shouldReset) {
    console.log(`🔍 Checking if contract code has changed...`);
    console.log(`   Previous deployment: ${previousAddress}`);
    const codeChanged = await checkIfCodeChanged(previousAddress, networkName, contractsRoot);
    
    if (codeChanged) {
      console.log(`\n🔄 Code has changed - automatically clearing deployment state for fresh deployment`);
      const deploymentDir = path.join(
        contractsRoot,
        "ignition",
        "deployments",
        `chain-${networkConfig.chainId}`
      );
      if (fs.existsSync(deploymentDir)) {
        fs.rmSync(deploymentDir, { recursive: true, force: true });
        console.log(`   ✅ Cleared previous deployment state\n`);
      }
      autoReset = true; // Will use --reset flag
    } else {
      console.log(`\n✅ Code unchanged - will reuse existing deployment\n`);
    }
  } else if (shouldReset) {
    console.log(`   ⚠️  Using --reset flag (will clear previous deployment state)\n`);
  } else {
    console.log(`   💡 No previous deployment found - fresh deployment\n`);
  }
  
  // Step 1: Deploy the contract
  const resetFlag = autoReset ? " --reset" : "";
  const deployCommand = `echo y | npx hardhat ignition deploy ignition/modules/TradingCardGame.ts --network ${networkName}${resetFlag} --parameters '{"TradingCardGameModule":{"pythAddress":"${networkConfig.pythAddress}"}}'`;
  
  try {
    console.log("📦 Running deployment...");
    execSync(deployCommand, { stdio: "inherit", cwd: contractsRoot });
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || "";
    const isBytecodeMismatch = 
      errorMessage.includes("Artifact bytecodes have been changed") ||
      errorMessage.includes("reconciliation failed") ||
      errorMessage.includes("contains changes to executed futures");
    
    console.error("\n❌ Deployment failed!");
    
    if (isBytecodeMismatch && !shouldReset) {
      console.error("\n🔍 Detected bytecode mismatch error!");
      console.error("   This means the contract was modified since last deployment.");
      console.error("   To deploy the updated contract, use the --reset flag:\n");
      console.error(`   ts-node scripts/deploy-and-verify.ts ${networkName} --reset\n`);
      console.error("   Or using npm:");
      console.error(`   npm run deploy:game:verify:${networkName} -- --reset\n`);
    } else if (isBytecodeMismatch && shouldReset) {
      console.error("\n⚠️  Reset flag was used but deployment still failed.");
      console.error("   You may need to manually clear the deployment state:");
      console.error(`   rm -rf ignition/deployments/chain-${networkConfig.chainId}\n`);
    } else {
      console.error("\n💡 Check the error message above for details.\n");
    }
    process.exit(1);
  }

  // Step 2: Get the deployed address
  const deployedAddress = getDeployedAddress(networkConfig.chainId);
  
  if (!deployedAddress) {
    console.error("❌ Could not find deployed contract address");
    process.exit(1);
  }

  // Determine explorer URL based on network
  const explorerUrls: Record<string, string> = {
    celo: `https://celoscan.io/address/${deployedAddress}`,
    alfajores: `https://alfajores.celoscan.io/address/${deployedAddress}`,
    sepolia: `https://celo-sepolia.blockscout.com/address/${deployedAddress}`,
  };
  const explorerUrl = explorerUrls[networkName] || `https://celoscan.io/address/${deployedAddress}`;

  console.log(`\n✅ Contract deployed successfully!`);
  console.log(`\n📍 Contract Address: ${deployedAddress}`);
  console.log(`🔗 View on Explorer: ${explorerUrl}`);
  
  // Check if this is a new deployment or update
  const deploymentPath = path.join(
    contractsRoot,
    "ignition",
    "deployments",
    `chain-${networkConfig.chainId}`,
    "deployed_addresses.json"
  );
  
  console.log(`\n📋 Deployment Information:`);
  console.log(`   Network: ${networkName} (Chain ID: ${networkConfig.chainId})`);
  console.log(`   Contract: TradingCardGame`);
  console.log(`   Address: ${deployedAddress}`);
  
  // Check if there was a previous deployment
  if (fs.existsSync(deploymentPath)) {
    const allDeployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const previousAddress = allDeployments["TradingCardGameModule#TradingCardGame"];
    
    if (previousAddress && previousAddress !== deployedAddress) {
      console.log(`   ⚠️  Previous deployment found at: ${previousAddress}`);
      console.log(`   ✅ New contract deployed at: ${deployedAddress}`);
      console.log(`\n💡 Important: Make sure you update your frontend config with the NEW address!`);
    } else if (previousAddress === deployedAddress) {
      console.log(`   ℹ️  Same address as previous deployment`);
      console.log(`   💡 If you see old code on explorer:`);
      console.log(`      1. Clear browser cache or use incognito mode`);
      console.log(`      2. Wait a few minutes for explorer to update`);
      console.log(`      3. Check the "Code" tab on the explorer - it should show the new bytecode`);
    }
  }
  
  console.log(`\n`);

  // Step 3: Verify the contract with retry logic
  console.log("\n🔍 Verifying contract on block explorer...");
  console.log("   Waiting 20 seconds for explorer to index the contract...");
  
  // Wait a bit for the explorer to index the contract
  for (let i = 20; i > 0; i--) {
    process.stdout.write(`\r   ${i} seconds remaining...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.stdout.write("\r   Starting verification...\n");
  
  const verifyCommand = `echo y | npx hardhat verify --network ${networkName} ${deployedAddress} "${networkConfig.pythAddress}"`;
  
  // Retry verification up to 3 times with exponential backoff
  const maxRetries = 3;
  let verificationSucceeded = false;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const waitTime = Math.min(30 * attempt, 60); // 30s, 60s, 60s
        console.log(`\n   ⏳ Retry attempt ${attempt}/${maxRetries} - waiting ${waitTime} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
      
      // Run verification and capture output to check for Sourcify success
      console.log(`   Executing verification command (attempt ${attempt}/${maxRetries})...\n`);
      const output = execSync(verifyCommand, { 
        stdio: "pipe",
        cwd: contractsRoot,
        encoding: "utf-8"
      });
      
      // Show the output
      console.log(output);
      
      // Check if Sourcify verification succeeded (even if Etherscan failed)
      const sourcifySuccess = output.includes("Successfully verified contract") && 
                             output.includes("Sourcify") &&
                             output.includes("https://repo.sourcify.dev");
      
      if (sourcifySuccess) {
        console.log(`\n✅ Contract verified successfully on Sourcify!`);
        console.log(`🔗 Verified Contract: ${explorerUrl}`);
        // Extract Sourcify URL if present
        const sourcifyMatch = output.match(/https:\/\/repo\.sourcify\.dev[^\s]+/);
        if (sourcifyMatch) {
          console.log(`🔗 Sourcify: ${sourcifyMatch[0]}`);
        }
        verificationSucceeded = true;
        break;
      } else if (output.includes("already verified") || output.includes("Contract source code already verified")) {
        console.log(`\n✅ Contract is already verified!`);
        console.log(`🔗 View on Explorer: ${explorerUrl}`);
        verificationSucceeded = true;
        break;
      } else {
        console.log(`\n✅ Verification completed!`);
        console.log(`🔗 Verified Contract: ${explorerUrl}`);
        verificationSucceeded = true;
        break;
      }
    } catch (error: any) {
      lastError = error;
      // Get stderr output to check for Sourcify success
      const stderr = error?.stderr?.toString() || "";
      const stdout = error?.stdout?.toString() || "";
      const combinedOutput = stdout + stderr;
      
      // Check if Sourcify verification succeeded (even if Etherscan failed)
      const sourcifySuccess = combinedOutput.includes("Successfully verified contract") && 
                             combinedOutput.includes("Sourcify") &&
                             combinedOutput.includes("https://repo.sourcify.dev");
      
      if (sourcifySuccess) {
        // Show the output
        if (stdout) console.log(stdout);
        if (stderr && !stderr.includes("deprecated")) console.log(stderr);
        
        console.log(`\n✅ Contract verified successfully on Sourcify!`);
        console.log(`🔗 Verified Contract: ${explorerUrl}`);
        // Extract Sourcify URL if present
        const sourcifyMatch = combinedOutput.match(/https:\/\/repo\.sourcify\.dev[^\s]+/);
        if (sourcifyMatch) {
          console.log(`🔗 Sourcify: ${sourcifyMatch[0]}`);
        }
        console.log(`\n⚠️  Note: Etherscan verification may have failed (API v1 deprecated), but Sourcify verification succeeded.`);
        verificationSucceeded = true;
        break;
      } else if (combinedOutput.includes("already verified") || combinedOutput.includes("Contract source code already verified")) {
        console.log(`\n✅ Contract is already verified!`);
        console.log(`🔗 View on Explorer: ${explorerUrl}`);
        verificationSucceeded = true;
        break;
      } else if (combinedOutput.includes("API key") || combinedOutput.includes("CELOSCAN_API_KEY") || combinedOutput.includes("Invalid API Key")) {
        console.error("\n❌ CELOSCAN_API_KEY not set or invalid!");
        console.error("   Get an API key at: https://celoscan.io/myapikey");
        console.error("   Add it to your .env file: CELOSCAN_API_KEY=your_key_here");
        // Don't retry if API key is invalid
        break;
      } else {
        // Show error output for this attempt
        if (attempt < maxRetries) {
          console.log(`\n   ⚠️  Verification attempt ${attempt} failed. Will retry...`);
          if (stdout) console.log(stdout);
          if (stderr && !stderr.includes("deprecated")) console.error(stderr);
        } else {
          // Last attempt failed
          if (stdout) console.log(stdout);
          if (stderr) console.error(stderr);
          
          console.error("\n💡 Verification failed after all retry attempts. Common reasons:");
          console.error("   - Contract not yet indexed by explorer (wait a few minutes and try manually)");
          console.error("   - Invalid constructor arguments");
          console.error("   - Network connectivity issues");
          console.error("\n   Try verifying manually:");
          console.error(`   npx hardhat verify --network ${networkName} ${deployedAddress} "${networkConfig.pythAddress}"`);
          console.error(`   Or: npm run verify:game:${networkName} ${deployedAddress} ${networkConfig.pythAddress}`);
          console.error(`\n   Check contract status: ${explorerUrl}`);
        }
      }
    }
  }
  
  if (verificationSucceeded) {
    // Verification succeeded, continue
  } else if (lastError) {
    // Verification failed after all retries, but don't exit with error
    // The contract is deployed, verification can be done manually later
    console.log(`\n⚠️  Verification failed, but contract is deployed. You can verify manually later.`);
  }

  console.log(`\n📝 Next Steps:`);
  console.log(`   1. Update your frontend config:`);
  console.log(`      NEXT_PUBLIC_TRADING_GAME_CONTRACT_ADDRESS=${deployedAddress}`);
  console.log(`   2. View contract on explorer: ${explorerUrl}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

