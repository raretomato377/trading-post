// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Pyth contract addresses for different networks
// These are the official Pyth Price Feed contract addresses
// Source: https://docs.pyth.network/price-feeds/contract-addresses
const PYTH_CONTRACTS: Record<string, string> = {
  // // Celo Sepolia (L2) - Update with actual address when available
  // sepolia: "0x0000000000000000000000000000000000000000", // TODO: Get actual address
  // Celo Alfajores Testnet
  alfajores: "0x74f09cb3c7e2A01865f424FD14F6dc9A14E3e94E",
  // Celo Mainnet
  celo: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
};

// HyperlaneCelo contract addresses for different networks
// Update these with your deployed HyperlaneCelo contract addresses
// You must deploy HyperlaneCelo separately before deploying TradingCardGame
const HYPERLANE_CELO_CONTRACTS: Record<string, string> = {
  // Celo Alfajores Testnet
  alfajores: "0x0000000000000000000000000000000000000000", // TODO: Update with your deployed address
  // Celo Mainnet
  celo: "0x2250798199B41CAC81C0A29Abc72204DA6997407",
  // Celo Sepolia (L2)
  sepolia: "0x0000000000000000000000000000000000000000", // TODO: Update with your deployed address
};

const TradingCardGameModule = buildModule("TradingCardGameModule", (m) => {
  // Get the Pyth contract address
  // You MUST provide it as a parameter: --parameters '{"TradingCardGameModule":{"pythAddress":"0x..."}}'
  // Or update the default below for your target network
  const pythAddress = m.getParameter(
    "pythAddress",
    // Default: use celo mainnet address (update this for your target network)
    PYTH_CONTRACTS.celo || "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C"
  );

  // Validate that pythAddress is provided
  if (!pythAddress || pythAddress.toString() ===  "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `Pyth contract address is required. ` +
      `Please provide it via --parameters '{"TradingCardGameModule":{"pythAddress":"0x..."}}' ` +
      `or update the default in this file.`
    );
  }

  // Get the HyperlaneCelo contract address
  // You can provide it as a parameter: --parameters '{"TradingCardGameModule":{"hyperlaneCeloAddress":"0x..."}}'
  // Or update the HYPERLANE_CELO_CONTRACTS mapping above with your deployed address
  const hyperlaneCeloAddress = m.getParameter(
    "hyperlaneCeloAddress",
    // Default: use address from mapping (update HYPERLANE_CELO_CONTRACTS above)
    HYPERLANE_CELO_CONTRACTS.celo || "0x0000000000000000000000000000000000000000"
  );

  // Validate that hyperlaneCeloAddress is provided
  if (!hyperlaneCeloAddress || hyperlaneCeloAddress.toString() ===  "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `HyperlaneCelo contract address is required. ` +
      `Please provide it via --parameters '{"TradingCardGameModule":{"hyperlaneCeloAddress":"0x..."}}' ` +
      `Note: HyperlaneCelo must be deployed separately first.`
    );
  }

  const tradingCardGame = m.contract("TradingCardGame", [pythAddress, hyperlaneCeloAddress]);

  return { tradingCardGame };
});

export default TradingCardGameModule;

