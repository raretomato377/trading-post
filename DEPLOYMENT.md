# Deployment Guide for Vercel

## Prerequisites

1. Vercel account (sign up at https://vercel.com)
2. GitHub account (to connect your repository)
3. Your app URL (will be provided by Vercel after deployment)

## Step 1: Push to GitHub

```bash
# Make sure your code is committed
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure the project:
   - **Framework Preset**: Next.js (or Auto-detect)
   - **Root Directory**: `apps/web` ⚠️ **CRITICAL: This MUST be set!**
   - **Build Command**: Leave as default (Next.js will auto-detect)
   - **Install Command**: `pnpm install` (or leave as default)
   - **Output Directory**: Leave as default (`.next`)
   
   **IMPORTANT**: 
   - The Root Directory setting is the most critical - it tells Vercel where your `package.json` with Next.js is located
   - After setting Root Directory to `apps/web`, Vercel should automatically detect Next.js from `apps/web/package.json`
   - If you still get "No Next.js version detected", double-check:
     1. Root Directory is exactly `apps/web` (not `apps/web/` with trailing slash)
     2. The `apps/web/package.json` file exists and has `"next"` in dependencies
     3. Try redeploying after setting the Root Directory

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
cd /home/ethglob25/trading-post/farcaster-miniapp
vercel

# Follow the prompts:
# - Set root directory to: apps/web
# - Override build command: pnpm build --filter=web
```

## Step 3: Configure Environment Variables

In Vercel dashboard, go to your project → Settings → Environment Variables and add:

### Required Variables

```
NEXT_PUBLIC_URL=https://your-app-name.vercel.app
NEXT_PUBLIC_APP_ENV=production
```

### Optional (for Farcaster account association)

```
NEXT_PUBLIC_FARCASTER_HEADER=your-header-value
NEXT_PUBLIC_FARCASTER_PAYLOAD=your-payload-value
NEXT_PUBLIC_FARCASTER_SIGNATURE=your-signature-value
```

### Pyth Network (when ready)

```
NEXT_PUBLIC_PYTH_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_HERMES_API_URL=https://hermes.pyth.network
NEXT_PUBLIC_CELO_NETWORK=alfajores
```

### Trading Game Contract (when ready)

```
NEXT_PUBLIC_TRADING_GAME_CONTRACT_ADDRESS=0x...
```

## Step 4: Update Farcaster Manifest

After deployment, update your Farcaster manifest:

1. Get your deployed URL from Vercel
2. Update `NEXT_PUBLIC_URL` in Vercel environment variables
3. The manifest will be available at: `https://your-app.vercel.app/api/manifest`

## Step 5: Test in Farcaster

1. Open Warpcast on your phone
2. Go to Settings → Developer → Domains
3. Add your Vercel domain
4. Generate domain manifest
5. Test your miniapp!

## Troubleshooting

### Build Fails

- Check that `pnpm` is installed in Vercel (it should auto-detect from `packageManager` field)
- Verify root directory is set to `apps/web` (this is critical!)
- Check build logs in Vercel dashboard

### "No Next.js version detected" Error

- **Solution**: Make sure the **Root Directory** is set to `apps/web` in Vercel dashboard
- Go to Project Settings → General → Root Directory
- Set it to: `apps/web`
- The `vercel.json` file should handle this, but sometimes you need to set it manually in the dashboard
- After setting the root directory, redeploy the project

### Farcaster Not Working

- Verify `NEXT_PUBLIC_URL` matches your Vercel deployment URL
- Check that environment variables are set correctly
- Ensure the manifest endpoint is accessible

### Wallet Connection Issues

- Make sure you're testing in Farcaster (not localhost)
- Check browser console for errors
- Verify wagmi configuration is correct

