import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Remove X-Frame-Options entirely - we'll use CSP instead
  // This should override any default Vercel adds
  response.headers.delete('X-Frame-Options');
  
  // Set Content-Security-Policy to allow embedding from Farcaster domains
  // CSP frame-ancestors is the modern way and takes precedence over X-Frame-Options
  const existingCSP = response.headers.get('Content-Security-Policy') || '';
  const frameAncestors = "frame-ancestors 'self' https://*.farcaster.xyz https://*.warpcast.com https://warpcast.com;";
  
  // Combine with existing CSP if any, or set new one
  if (existingCSP) {
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

