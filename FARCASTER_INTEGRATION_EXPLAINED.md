# Farcaster Integration Explained

## Overview

Your app uses the **official Farcaster miniapp SDK** and follows the recommended patterns. Here's how it all works:

## Architecture Components

### 1. **Farcaster Frame SDK** (`@farcaster/frame-sdk`)
**Location**: `apps/web/src/contexts/miniapp-context.tsx`

**What it does**:
- Provides the core SDK for communicating with Farcaster clients (Warpcast)
- Handles context (user info, client info)
- Manages the miniapp lifecycle

**How it works**:
```typescript
import { sdk } from "@farcaster/frame-sdk";

// Get user context (who is using the app)
const context = await sdk.context;

// Tell Farcaster the app is ready
await sdk.actions.ready();

// Add the app to the user's frame (optional)
await sdk.actions.addFrame();
```

**✅ Recommended**: Yes, this is the official SDK from Farcaster.

---

### 2. **Farcaster Wagmi Connector** (`@farcaster/miniapp-wagmi-connector`)
**Location**: `apps/web/src/contexts/frame-wallet-context.tsx`

**What it does**:
- Connects Farcaster's built-in wallet to Wagmi
- Allows your app to interact with blockchain (read contracts, send transactions)
- Uses the user's Farcaster custody wallet

**How it works**:
```typescript
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

const config = createConfig({
  chains: [celo, celoAlfajores, celoSepolia],
  connectors: [farcasterMiniApp()], // This is the magic!
  transports: { /* ... */ }
});
```

**✅ Recommended**: Yes, this is the official connector for wallet integration.

---

### 3. **Manifest Endpoint** (`.well-known/farcaster.json`)
**Location**: `apps/web/src/app/.well-known/farcaster.json/route.ts`

**What it does**:
- Provides metadata about your miniapp
- Includes account association (proves you own the domain)
- Required for Farcaster to discover and display your app

**How it works**:
- Farcaster clients fetch: `https://yourdomain.com/.well-known/farcaster.json`
- Returns manifest with app name, icon, description, etc.
- Includes signed account association (header, payload, signature)

**✅ Recommended**: Yes, this is the standard endpoint per Farcaster spec.

---

## Integration Flow

### Step 1: App Initialization
```
1. User opens your app in Warpcast
2. Farcaster SDK initializes (miniapp-context.tsx)
3. SDK gets user context (who is logged in)
4. SDK calls ready() to signal app is loaded
```

### Step 2: Wallet Connection
```
1. Wagmi connector detects Farcaster environment
2. Auto-connects to Farcaster wallet (page.tsx)
3. User's wallet address is available via useAccount()
4. Can now read/write to smart contracts
```

### Step 3: Contract Interactions
```
1. useReadContract() reads from your contract
2. useWriteContract() writes to your contract
3. All transactions use the user's Farcaster wallet
4. No need for MetaMask or other wallets!
```

## Current Implementation

### ✅ What's Working Well:

1. **SDK Initialization** (`miniapp-context.tsx`):
   - ✅ Properly waits for component mount (prevents hydration issues)
   - ✅ Only initializes in Farcaster (skips on localhost)
   - ✅ Calls `sdk.actions.ready()` when ready
   - ✅ Handles errors gracefully

2. **Wallet Integration** (`frame-wallet-context.tsx`):
   - ✅ Uses official `farcasterMiniApp()` connector
   - ✅ Configured for Celo networks (mainnet, Alfajores, Sepolia)
   - ✅ RPC proxy for CORS handling (`/api/rpc`)

3. **Auto-Connect** (`page.tsx`):
   - ✅ Only runs in Farcaster environment
   - ✅ Waits for miniapp to be ready
   - ✅ Finds and connects to Farcaster connector
   - ✅ Shows connection status in UI

4. **Manifest** (`.well-known/farcaster.json`):
   - ✅ Proper endpoint structure
   - ✅ Account association support
   - ✅ Development fallbacks for localhost

### ⚠️ Potential Improvements:

1. **Connector ID Detection**:
   ```typescript
   // Current: Tries multiple IDs
   const farcasterConnector = connectors.find(c => 
     c.id === 'farcaster' || 
     c.id === 'farcasterMiniApp' ||
     c.name?.toLowerCase().includes('farcaster')
   );
   ```
   **Issue**: The connector ID might be different. Check console logs to see what ID is actually used.

2. **Environment Detection**:
   ```typescript
   // Current: Checks hostname
   const isFarcasterEnv = window.location.hostname.includes('farcaster') || 
                          window.location.hostname.includes('warpcast');
   ```
   **Better**: Could also check for `window.farcaster` or SDK context availability.

3. **Error Handling**:
   - Currently silently fails on localhost (good)
   - Could add retry logic for failed connections
   - Could show user-friendly error messages

---

## Recommended Methods Check

| Component | Method | Status | Notes |
|-----------|--------|--------|-------|
| SDK | `@farcaster/frame-sdk` | ✅ Official | Standard SDK |
| Wallet | `@farcaster/miniapp-wagmi-connector` | ✅ Official | Recommended connector |
| Manifest | `.well-known/farcaster.json` | ✅ Standard | Per Farcaster spec |
| Account Association | Signed manifest | ✅ Required | Domain verification |
| SDK Ready | `sdk.actions.ready()` | ✅ Recommended | Signals app ready |
| Add Frame | `sdk.actions.addFrame()` | ⚠️ Optional | Only if you want to add to user's frame |

---

## Testing in Farcaster Developer Tool

When you test in the developer tool:

1. **SDK Context**: Should automatically get user info
2. **Wallet**: Should auto-connect (check console for connector ID)
3. **Contract Calls**: Should work once wallet is connected
4. **Manifest**: Should be accessible at `/.well-known/farcaster.json`

### Debugging Tips:

1. **Check Console Logs**:
   - Look for "🔗 Auto-connecting to Farcaster wallet..."
   - Check what connector ID is found
   - Watch for any connection errors

2. **Verify Wallet Connection**:
   - Check if `isConnected` is `true`
   - Verify `address` is populated
   - Test a contract read to confirm

3. **Check Manifest**:
   ```bash
   curl https://your-domain.vercel.app/.well-known/farcaster.json
   ```

---

## Summary

**✅ You're using the recommended methods!**

- Official Farcaster SDK
- Official Wagmi connector
- Standard manifest endpoint
- Proper initialization flow

**Minor improvements**:
- Verify the actual connector ID (check console)
- Consider better environment detection
- Add more error handling/retry logic

The integration should work in Farcaster's developer tool. The wallet will auto-connect, and you'll be able to interact with your smart contracts!

