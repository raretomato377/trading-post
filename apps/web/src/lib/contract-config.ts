/**
 * Contract Configuration
 * 
 * This file will contain the contract ABI and address when ready.
 * For now, we use mock functions in mock-contract.ts
 * 
 * TO SWAP TO REAL CONTRACT:
 * 1. Add your contract ABI and address here
 * 2. Update mock-contract.ts to use real contract calls
 * 3. Or create a new contract.ts file and update imports
 */

// TODO: Add contract address when deployed
export const TRADING_GAME_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TRADING_GAME_CONTRACT_ADDRESS || "";

// TODO: Add contract ABI when ready
export const TRADING_GAME_ABI = [
  // {
  //   name: "getRandomCardNumbers",
  //   type: "function",
  //   stateMutability: "view",
  //   inputs: [{ name: "count", type: "uint256" }],
  //   outputs: [{ name: "", type: "uint256[]" }],
  // },
  // Add other function ABIs here
] as const;

/**
 * Check if we're using the real contract or mock
 * Set this to true when contract is ready
 */
export const USE_REAL_CONTRACT = false;

