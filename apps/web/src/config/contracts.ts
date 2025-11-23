// RandomNumbers Contract on Celo Mainnet
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

// Celo Mainnet Chain ID
export const CELO_MAINNET_CHAIN_ID = 42220;

// Polling interval for contract reads (in milliseconds)
// Can be configured via NEXT_PUBLIC_POLLING_INTERVAL_MS environment variable
// Defaults to 10 seconds (10000ms)
export const POLLING_INTERVAL_MS = parseInt(
  process.env.NEXT_PUBLIC_POLLING_INTERVAL_MS || '10000',
  10
);

// TradingCardGame Contract
// Address can be set via NEXT_PUBLIC_TRADING_GAME_CONTRACT_ADDRESS environment variable
// Falls back to hardcoded address if env var is not set
export const TRADING_CARD_GAME_CONTRACT = {
  address: (process.env.NEXT_PUBLIC_TRADING_GAME_CONTRACT_ADDRESS || '0x40df882537ccFA98e39715C9f8459f72247c076A') as `0x${string}`,
  abi: [
    {
      inputs: [],
      name: 'createGame',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'uint256', name: '_gameId', type: 'uint256' }],
      name: 'joinGame',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'uint256', name: '_gameId', type: 'uint256' }],
      name: 'canStartGame',
      outputs: [
        { internalType: 'bool', name: 'canStart', type: 'bool' },
        { internalType: 'string', name: 'reason', type: 'string' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: '_gameId', type: 'uint256' },
        { internalType: 'bool', name: '_useSecureRandomness', type: 'bool' },
      ],
      name: 'startGame',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: '_gameId', type: 'uint256' },
        { internalType: 'bool', name: '_useSecureRandomness', type: 'bool' },
      ],
      name: 'generateCards',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: '_gameId', type: 'uint256' },
        { internalType: 'uint256[3]', name: '_cardNumbers', type: 'uint256[3]' },
      ],
      name: 'commitChoices',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: '_gameId', type: 'uint256' },
        { internalType: 'bytes[]', name: '_priceUpdateData', type: 'bytes[]' },
        { internalType: 'bytes32[]', name: '', type: 'bytes32[]' },
        { internalType: 'uint256', name: '_updateFee', type: 'uint256' },
      ],
      name: 'updatePricesAndResolve',
      outputs: [],
      stateMutability: 'payable',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'uint256', name: '_gameId', type: 'uint256' }],
      name: 'endGame',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'uint256', name: '_gameId', type: 'uint256' }],
      name: 'getGameState',
      outputs: [
        { internalType: 'uint8', name: 'status', type: 'uint8' },
        { internalType: 'uint256', name: 'startTime', type: 'uint256' },
        { internalType: 'uint256', name: 'lobbyDeadline', type: 'uint256' },
        { internalType: 'uint256', name: 'choiceDeadline', type: 'uint256' },
        { internalType: 'uint256', name: 'resolutionDeadline', type: 'uint256' },
        { internalType: 'uint256', name: 'playerCount', type: 'uint256' },
        { internalType: 'uint256', name: 'cardCount', type: 'uint256' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'uint256', name: '_gameId', type: 'uint256' }],
      name: 'getGamePlayers',
      outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'uint256', name: '_gameId', type: 'uint256' }],
      name: 'getGameCards',
      outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: '_gameId', type: 'uint256' },
        { internalType: 'address', name: '_player', type: 'address' },
      ],
      name: 'getPlayerChoices',
      outputs: [
        { internalType: 'uint256[3]', name: 'selectedCards', type: 'uint256[3]' },
        { internalType: 'uint256', name: 'committedAt', type: 'uint256' },
        { internalType: 'bool', name: 'committed', type: 'bool' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'uint256', name: '_gameId', type: 'uint256' },
        { internalType: 'uint256', name: '_cardNumber', type: 'uint256' },
      ],
      name: 'getPredictionResult',
      outputs: [
        { internalType: 'bool', name: 'correct', type: 'bool' },
        { internalType: 'uint256', name: 'pointsEarned', type: 'uint256' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'address', name: '_player', type: 'address' }],
      name: 'getPlayerScore',
      outputs: [
        { internalType: 'uint256', name: 'totalPoints', type: 'uint256' },
        { internalType: 'uint256', name: 'gamesPlayed', type: 'uint256' },
        { internalType: 'uint256', name: 'gamesWon', type: 'uint256' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [],
      name: 'getNextGameId',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const,
} as const;
