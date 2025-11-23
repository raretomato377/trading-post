# Trading Card Game - Farcaster Miniapp

A trading prediction game built on Celo, integrated with Farcaster and Pyth Network price feeds.

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- A Farcaster account (for testing in Warpcast)
- A wallet with testnet tokens (for contract deployment)

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

This is a monorepo managed by Turborepo:

- `apps/web` - Next.js frontend application
- `apps/contracts` - Smart contracts (Hardhat)

## Available Scripts

### Frontend

- `pnpm dev` - Start development servers
- `pnpm build` - Build all packages and apps
- `pnpm lint` - Lint all packages and apps
- `pnpm type-check` - Run TypeScript type checking

### Smart Contracts

- `pnpm contracts:compile` - Compile smart contracts
- `pnpm contracts:test` - Run smart contract tests
- `pnpm contracts:deploy:game:sepolia` - Deploy TradingCardGame to Celo Sepolia
- `pnpm contracts:deploy:game:alfajores` - Deploy to Celo Alfajores testnet
- `pnpm contracts:deploy:game:celo` - Deploy to Celo mainnet
- `pnpm contracts:deploy:game:verify:sepolia` - Deploy and auto-verify on Celo Sepolia
- `pnpm contracts:deploy:game:verify:alfajores` - Deploy and auto-verify on Alfajores
- `pnpm contracts:deploy:game:verify:celo` - Deploy and auto-verify on Celo mainnet
- `pnpm contracts:verify:game:sepolia <CONTRACT_ADDRESS> <PYTH_ADDRESS>` - Manually verify on Celo Sepolia
- `pnpm contracts:verify:game:alfajores <CONTRACT_ADDRESS> <PYTH_ADDRESS>` - Manually verify on Alfajores
- `pnpm contracts:verify:game:celo <CONTRACT_ADDRESS> <PYTH_ADDRESS>` - Manually verify on Celo Mainnet
- `pnpm contracts:check:bytecode <CONTRACT_ADDRESS> [network]` - Check if on-chain bytecode matches compiled bytecode

## Smart Contract Development

### Setup

1. **Create environment file:**
   ```bash
   cd apps/contracts
   cp .env.example .env
   ```

2. **Add your private key:**
   ```env
   PRIVATE_KEY=your_private_key_without_0x_prefix
   CELOSCAN_API_KEY=your_celoscan_api_key  # Optional, for verification
   HARDHAT_DISABLE_TELEMETRY=1  # Disable telemetry prompt (prevents freezing)
   ```

3. **Get Pyth contract address:**
   - Visit: https://docs.pyth.network/price-feeds/contract-addresses
   - Find the address for your target network (Celo Sepolia, Alfajores, or Mainnet)
   - Update `ignition/modules/TradingCardGame.ts` with the address

### Deploy TradingCardGame Contract

**Option 1: Deploy with Automatic Verification (Recommended)**

This will deploy and automatically verify the contract on the block explorer:

```bash
cd apps/contracts
npm run deploy:game:verify:alfajores  # For Alfajores testnet
npm run deploy:game:verify:sepolia     # For Celo Sepolia
npm run deploy:game:verify:celo        # For Celo mainnet
```

**✨ Automatic Code Change Detection**

The deployment script automatically detects when your contract code has changed and will:
- Compare compiled bytecode with on-chain bytecode
- Automatically clear deployment state if code changed
- Deploy to a new address when code is updated
- Reuse existing deployment if code is unchanged

This means you can simply run the deploy command - no need to manually handle `--reset` flags!

**Manual Reset (if needed)**

If you want to force a fresh deployment even when code hasn't changed, use the `--reset` flag:

```bash
# Using the script directly
ts-node scripts/deploy-and-verify.ts celo --reset

# Or using npm (pass --reset after --)
npm run deploy:game:verify:celo -- --reset
```

**Option 2: Deploy Only (Manual Verification)**

If you prefer to verify manually later:

```bash
cd apps/contracts
npm run deploy:game:alfajores
npm run deploy:game:sepolia
npm run deploy:game:celo
```

Then verify manually:
```bash
npm run verify:game:alfajores <CONTRACT_ADDRESS> <PYTH_ADDRESS>
```

### Update Frontend After Deployment

After deploying, update the contract address in `apps/web/src/config/contracts.ts`:

```typescript
export const TRADING_CARD_GAME_CONTRACT = {
  address: '0x...' as const, // Your deployed address
  // ...
};
```

### Verify Contract on Block Explorer

**Automatic Verification (Recommended)**

If you use the `deploy:game:verify:*` scripts, verification happens automatically after deployment:

```bash
cd apps/contracts
npm run deploy:game:verify:alfajores  # Deploys and verifies automatically
```

**Manual Verification**

If you deployed without verification, you can verify manually:

1. **Get your contract address** from the deployment output

2. **Verify using Hardhat**:
   ```bash
   cd apps/contracts
   
   # Using npm scripts (recommended)
   npm run verify:game:celo <CONTRACT_ADDRESS> <PYTH_ADDRESS>
   npm run verify:game:alfajores <CONTRACT_ADDRESS> <PYTH_ADDRESS>
   npm run verify:game:sepolia <CONTRACT_ADDRESS> <PYTH_ADDRESS>
   
   # Or using hardhat directly
   npx hardhat verify --network celo <CONTRACT_ADDRESS> <PYTH_ADDRESS>
   ```

3. **Make sure `CELOSCAN_API_KEY` is set** in your `.env` file (get one at https://celoscan.io/myapikey)

After verification, your contract source code will be visible on the block explorer (celoscan.io, alfajores.celoscan.io, etc.)

### Networks

- **Celo Sepolia (L2 Testnet)**: Chain ID 11142220
- **Celo Alfajores (Testnet)**: Chain ID 44787
- **Celo Mainnet**: Chain ID 42220

## Deployment

### Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy via Vercel Dashboard:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - **Critical**: Set **Root Directory** to `apps/web`
   - Framework will auto-detect as Next.js

3. **Configure Environment Variables:**
   ```
   NEXT_PUBLIC_URL=https://your-app.vercel.app
   NEXT_PUBLIC_APP_ENV=production
   ```

### Farcaster Setup

#### For Development (using ngrok)

1. **Start dev server and expose with ngrok:**
   ```bash
   pnpm dev
   ngrok http 3000
   ```

2. **Generate account association:**
   - Visit: https://farcaster.xyz/~/developers/mini-apps/manifest?domain=your-ngrok-url.ngrok-free.app
   - Sign in and sign the manifest
   - Copy the `header`, `payload`, and `signature` values

3. **Add to `.env.local`:**
   ```env
   NEXT_PUBLIC_URL=https://your-ngrok-url.ngrok-free.app
   NEXT_PUBLIC_FARCASTER_HEADER=your-header
   NEXT_PUBLIC_FARCASTER_PAYLOAD=your-payload
   NEXT_PUBLIC_FARCASTER_SIGNATURE=your-signature
   ```

#### For Production

1. **Deploy to Vercel** (see above)

2. **Generate account association:**
   - Visit: https://farcaster.xyz/~/developers/mini-apps/manifest?domain=yourdomain.com
   - Sign the manifest
   - Copy the values

3. **Add to Vercel environment variables:**
   ```
   NEXT_PUBLIC_URL=https://yourdomain.com
   NEXT_PUBLIC_FARCASTER_HEADER=your-header
   NEXT_PUBLIC_FARCASTER_PAYLOAD=your-payload
   NEXT_PUBLIC_FARCASTER_SIGNATURE=your-signature
   ```

4. **Test in Warpcast:**
   - Open Warpcast on your phone
   - Go to Settings → Developer → Domains
   - Add your domain and test the miniapp

### Environment Variables

#### Required

- `NEXT_PUBLIC_URL` - Your app's public URL
- `NEXT_PUBLIC_APP_ENV` - `development` or `production`

#### Farcaster (for production)

- `NEXT_PUBLIC_FARCASTER_HEADER` - Account association header
- `NEXT_PUBLIC_FARCASTER_PAYLOAD` - Account association payload
- `NEXT_PUBLIC_FARCASTER_SIGNATURE` - Account association signature

#### Pyth Network (when ready)

- `NEXT_PUBLIC_PYTH_CONTRACT_ADDRESS` - Pyth contract address
- `NEXT_PUBLIC_HERMES_API_URL` - Hermes API URL (default: https://hermes.pyth.network)
- `NEXT_PUBLIC_CELO_NETWORK` - Network name (`alfajores`, `sepolia`, or `celo`)

#### Contract (after deployment)

- `NEXT_PUBLIC_TRADING_GAME_CONTRACT_ADDRESS` - Your deployed TradingCardGame address

## Troubleshooting

### Build Fails on Vercel

- **"No Next.js version detected"**: Make sure **Root Directory** is set to `apps/web` in Vercel dashboard
- Check build logs in Vercel dashboard
- Verify `pnpm` is being used (should auto-detect from `packageManager` field)

### Farcaster Not Working

- Verify `NEXT_PUBLIC_URL` matches your deployment URL exactly
- Check that all three Farcaster environment variables are set
- Ensure manifest is accessible: `curl https://your-domain/.well-known/farcaster.json`
- Test in Warpcast developer tool, not just localhost

### Wallet Connection Issues

- Make sure you're testing in Farcaster/Warpcast (not just localhost)
- Check browser console for errors
- Verify wagmi configuration in `apps/web/src/contexts/frame-wallet-context.tsx`

### Contract Deployment Issues

- **"Pyth contract address not set"**: Update `PYTH_CONTRACTS` in deployment file or pass as parameter
- **"Insufficient funds"**: Get testnet tokens from faucets
- **"Network not found"**: Verify network name matches Hardhat config (`sepolia`, `alfajores`, `celo`)

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Smart Contracts**: Hardhat with Solidity
- **Blockchain**: Celo
- **Oracle**: Pyth Network
- **Social**: Farcaster Miniapp SDK
- **Wallet**: Farcaster Wagmi Connector
- **Monorepo**: Turborepo
- **Package Manager**: PNPM

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Celo Documentation](https://docs.celo.org/)
- [Pyth Network Documentation](https://docs.pyth.network/)
- [Farcaster Miniapps](https://miniapps.farcaster.xyz/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
