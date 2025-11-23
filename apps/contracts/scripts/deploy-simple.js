require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  // Network configuration
  const networks = {
    base: {
      rpc: "https://mainnet.base.org",
      chainId: 8453,
      explorer: "https://basescan.org"
    },
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
  const contractName = process.argv[3] || "Lock";
  const network = networks[networkName];

  if (!network) {
    console.error(`Unknown network: ${networkName}`);
    console.log("Available networks:", Object.keys(networks).join(", "));
    process.exit(1);
  }

  const validContracts = ["Lock", "RandomNumbers", "HyperlaneBase", "HyperlaneCelo", "ExampleEntropyConsumer"];
  if (!validContracts.includes(contractName)) {
    console.error(`Unknown contract: ${contractName}`);
    console.log("Available contracts:", validContracts.join(", "));
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
  console.log("Contract:", contractName);
  console.log("Deployer address:", wallet.address);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "tokens\n");

  // Read compiled contract
  let sourceFile = contractName;

  const contractArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../artifacts/contracts/${sourceFile}.sol/${contractName}.json`),
      "utf8"
    )
  );

  // Deploy contract
  const factory = new ethers.ContractFactory(
    contractArtifact.abi,
    contractArtifact.bytecode,
    wallet
  );

  let contract;

  if (contractName === "Lock") {
    // Get the current timestamp and add 1 year for unlock time
    const currentTimestampInSeconds = Math.round(Date.now() / 1000);
    const unlockTime = currentTimestampInSeconds + 365 * 24 * 60 * 60;
    const lockedAmount = ethers.parseEther("0.001");

    console.log("Unlock time:", new Date(unlockTime * 1000).toLocaleString());
    console.log("Locked amount:", ethers.formatEther(lockedAmount), "tokens\n");

    console.log("Deploying Lock contract...");
    contract = await factory.deploy(unlockTime, { value: lockedAmount });
  } else if (contractName === "RandomNumbers") {
    console.log("Deploying RandomNumbers contract...");
    contract = await factory.deploy();
  } else if (contractName === "HyperlaneBase") {
    console.log("Deploying HyperlaneBase contract...");
    contract = await factory.deploy();
  } else if (contractName === "HyperlaneCelo") {
    // HyperlaneCelo requires constructor params: sourceDomain and sourceContract
    const sourceDomain = 8453; // Base mainnet domain ID
    const sourceContract = process.argv[4]; // Get from command line

    if (!sourceContract) {
      console.error("\nError: HyperlaneCelo requires the HyperlaneBase contract address");
      console.error("Usage: node scripts/deploy-simple.js celo HyperlaneCelo <HyperlaneBase_address>");
      process.exit(1);
    }

    console.log("Deploying HyperlaneCelo contract...");
    console.log("Source Domain (Base):", sourceDomain);
    console.log("Source Contract:", sourceContract);
    contract = await factory.deploy(sourceDomain, sourceContract);
  } else if (contractName === "ExampleEntropyConsumer") {
    // ExampleEntropyConsumer requires the HyperlaneCelo contract address
    const hyperlaneCeloAddress = process.argv[4]; // Get from command line

    if (!hyperlaneCeloAddress) {
      console.error("\nError: ExampleEntropyConsumer requires the HyperlaneCelo contract address");
      console.error("Usage: node scripts/deploy-simple.js celo ExampleEntropyConsumer <HyperlaneCelo_address>");
      process.exit(1);
    }

    console.log("Deploying ExampleEntropyConsumer contract...");
    console.log("HyperlaneCelo Contract:", hyperlaneCeloAddress);
    contract = await factory.deploy(hyperlaneCeloAddress);
  }

  console.log("Waiting for deployment...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log(`\n✅ ${contractName} contract deployed to: ${address}`);
  console.log(`   View on Explorer: ${network.explorer}/address/${address}`);

  // Print verification command
  console.log(`\nTo verify this contract, run:`);
  if (contractName === "HyperlaneCelo") {
    const sourceDomain = 8453;
    const sourceContract = process.argv[4];
    console.log(`npx hardhat verify --network ${networkName} ${address} ${sourceDomain} ${sourceContract}\n`);
  } else if (contractName === "ExampleEntropyConsumer") {
    const hyperlaneCeloAddress = process.argv[4];
    console.log(`npx hardhat verify --network ${networkName} ${address} ${hyperlaneCeloAddress}\n`);
  } else if (contractName === "Lock") {
    const currentTimestampInSeconds = Math.round(Date.now() / 1000);
    const unlockTime = currentTimestampInSeconds + 365 * 24 * 60 * 60;
    console.log(`npx hardhat verify --network ${networkName} ${address} ${unlockTime}\n`);
  } else {
    console.log(`npx hardhat verify --network ${networkName} ${address}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
