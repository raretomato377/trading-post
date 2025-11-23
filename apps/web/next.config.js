/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/:path*',
        headers: [
          {
            // Allow embedding from Farcaster domains using CSP
            // X-Frame-Options is handled by middleware to override Vercel's default
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.farcaster.xyz https://*.warpcast.com https://warpcast.com;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
