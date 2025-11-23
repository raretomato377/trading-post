import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Log referer to help debug what domain is trying to embed us
  const referer = request.headers.get('referer');
  if (referer) {
    console.log('🔍 Request referer:', referer);
  }

  // Remove X-Frame-Options entirely - we'll use CSP instead
  // This should override any default Vercel adds
  response.headers.delete('X-Frame-Options');
  
  // Set Content-Security-Policy to allow embedding from Farcaster domains
  // CSP frame-ancestors is the modern way and takes precedence over X-Frame-Options
  // Note: CSP wildcards in frame-ancestors are limited - we list specific domains
  const existingCSP = response.headers.get('Content-Security-Policy') || '';
  
  // Temporarily allow all origins to test - check logs to see actual embedding domain
  // Once we know the domain, we can restrict it for security
  const frameAncestors = "frame-ancestors *;";
  
  // After testing, replace with specific domains:
  // const frameAncestors = "frame-ancestors 'self' https://warpcast.com https://app.warpcast.com https://client.farcaster.xyz https://farcaster.xyz;";
  
  // Combine with existing CSP if any, or set new one
  // If there's an existing CSP, we need to replace frame-ancestors if it exists
  if (existingCSP && existingCSP.includes('frame-ancestors')) {
    // Replace existing frame-ancestors directive
    const updatedCSP = existingCSP.replace(/frame-ancestors[^;]*;?/g, '').trim() + ' ' + frameAncestors;
    response.headers.set('Content-Security-Policy', updatedCSP);
  } else if (existingCSP) {
    response.headers.set('Content-Security-Policy', `${existingCSP} ${frameAncestors}`);
  } else {
    response.headers.set('Content-Security-Policy', frameAncestors);
  }

  return response;
}

export const config = {
  // Match all paths except static files and API routes that don't need framing
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

