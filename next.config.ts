import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Development only (ignored by `next build`): lets a browser on the LAN open
  // the dev server via this machine's network IP. Without it, Next.js blocks
  // cross-origin requests to /_next/* dev resources, so pages render but never
  // hydrate — client-side forms silently fall back to native GET submits.
  allowedDevOrigins: ['172.19.16.1'],
};

export default nextConfig;
