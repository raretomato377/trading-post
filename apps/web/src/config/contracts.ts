// RandomNumbers Contract on Celo Sepolia
export const RANDOM_NUMBERS_CONTRACT = {
  address: '0x8915604660b2EFd8376C99DB2F1e013CCe30b871' as const,
  abi: [
    {
      inputs: [],
      name: 'getAllNumbers',
      outputs: [
        {
          internalType: 'uint256[4]',
          name: '',
          type: 'uint256[4]',
        },
      ],
      stateMutability: 'pure',
      type: 'function',
    },
    {
      inputs: [],
      name: 'getNumbers',
      outputs: [
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
        {
          internalType: 'uint256',
          name: '',
          type: 'uint256',
        },
      ],
      stateMutability: 'pure',
      type: 'function',
    },
  ] as const,
} as const;

// Celo Sepolia Chain ID (L2)
export const CELO_SEPOLIA_CHAIN_ID = 11142220;
