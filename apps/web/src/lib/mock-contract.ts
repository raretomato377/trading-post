/**
 * Mock contract functions
 * 
 * ========================================
 * HOW TO SWAP TO REAL CONTRACT:
 * ========================================
 * 
 * 1. Create a new file: lib/real-contract.ts
 * 2. Import wagmi hooks and your contract ABI:
 *    import { useReadContract, useWriteContract } from 'wagmi';
 *    import { TRADING_GAME_ABI, TRADING_GAME_CONTRACT_ADDRESS } from './contract-config';
 * 
 * 3. Replace getRandomCardNumbers with:
 *    export async function getRandomCardNumbers(count: number): Promise<number[]> {
 *      const { data } = useReadContract({
 *        address: TRADING_GAME_CONTRACT_ADDRESS,
 *        abi: TRADING_GAME_ABI,
 *        functionName: 'getRandomCardNumbers',
 *        args: [count],
 *      });
 *      return data || [];
 *    }
 * 
 * 4. Update use-mock-contract.ts to import from real-contract.ts instead
 * 5. Remove the mock indicator from card-game.tsx
 * 
 * ========================================
 * 
 * The real contract should have a function:
 * function getRandomCardNumbers(uint256 count) public view returns (uint256[] memory)
 * 
 * For now, we simulate this with client-side random generation
 */

/**
 * Generate random 4-digit numbers (0000-9999)
 * This simulates what the contract will return
 * 
 * @param count - Number of card numbers to generate
 * @returns Array of 4-digit numbers
 * 
 * TODO: Replace with actual contract call when ready:
 * 
 * import { useReadContract } from 'wagmi';
 * import { tradingGameContract } from '@/lib/contracts';
 * 
 * const { data: numbers } = useReadContract({
 *   ...tradingGameContract,
 *   functionName: 'getRandomCardNumbers',
 *   args: [count],
 * });
 * return numbers || [];
 */
export async function getRandomCardNumbers(count: number): Promise<number[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock implementation - generates random 4-digit numbers
  const numbers: number[] = [];
  const used = new Set<number>();

  while (numbers.length < count) {
    const num = Math.floor(Math.random() * 10000); // 0000-9999
    if (!used.has(num)) {
      used.add(num);
      numbers.push(num);
    }
  }

  return numbers;
}

/**
 * Select cards on contract
 * TODO: Replace with real contract call
 * 
 * @param roundId - Current round ID
 * @param cardNumbers - Array of selected card numbers
 * @returns Transaction hash
 */
export async function selectCards(
  roundId: number,
  cardNumbers: number[]
): Promise<string> {
  // TODO: Replace with actual contract call
  // const contract = getContract();
  // const tx = await contract.selectCards(roundId, cardNumbers);
  // return tx.hash;

  // Mock implementation
  console.log(`Mock: Selecting cards for round ${roundId}:`, cardNumbers);
  return `0x${Math.random().toString(16).substring(2, 66)}`;
}

/**
 * Get current round ID
 * TODO: Replace with real contract call
 * 
 * @returns Current round ID
 */
export async function getCurrentRound(): Promise<number> {
  // TODO: Replace with actual contract call
  // const contract = getContract();
  // return await contract.getCurrentRound();

  // Mock implementation - returns round based on current hour
  const now = new Date();
  const hour = now.getHours();
  const day = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return day * 24 + hour;
}

/**
 * Check if user can generate new cards
 * TODO: Replace with real contract call
 * 
 * @returns True if user can generate cards
 */
export async function canGenerateCards(): Promise<boolean> {
  // TODO: Replace with actual contract call
  // const contract = getContract();
  // return await contract.canGenerateCards();

  // Mock implementation - allow once per hour
  return true;
}

/**
 * Get user's score
 * TODO: Replace with real contract call
 * 
 * @param address - User's wallet address
 * @returns User's total score
 */
export async function getUserScore(address: string): Promise<number> {
  // TODO: Replace with actual contract call
  // const contract = getContract();
  // return await contract.getUserScore(address);

  // Mock implementation
  return Math.floor(Math.random() * 1000);
}

/**
 * Get leaderboard
 * TODO: Replace with real contract call
 * 
 * @param limit - Number of top players to return
 * @returns Array of { address, score } objects
 */
export async function getLeaderboard(limit: number = 10): Promise<Array<{ address: string; score: number }>> {
  // TODO: Replace with actual contract call
  // const contract = getContract();
  // return await contract.getLeaderboard(limit);

  // Mock implementation
  return Array.from({ length: limit }, (_, i) => ({
    address: `0x${Math.random().toString(16).substring(2, 42)}`,
    score: 1000 - i * 50,
  }));
}

