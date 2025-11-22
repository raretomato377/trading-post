import { NextResponse } from "next/server";

// Farcaster Hosted Manifest URL
const FARCASTER_HOSTED_MANIFEST_URL = "https://api.farcaster.xyz/miniapps/hosted-manifest/019aad21-bb42-c435-55cf-f02d34294587";

export async function GET() {
  // Temporarily redirect (307) to Farcaster hosted manifest
  // 307 is a temporary redirect that preserves the HTTP method
  return NextResponse.redirect(FARCASTER_HOSTED_MANIFEST_URL, {
    status: 307,
  });
}
