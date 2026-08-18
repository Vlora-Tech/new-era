import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Development only (ignored by `next build`): lets a browser on the LAN open
  // the dev server via this machine's network IP. Without it, Next.js blocks
  // cross-origin requests to /_next/* dev resources, so pages render but never
  // hydrate — client-side forms silently fall back to native GET submits.
  allowedDevOrigins: [
    '172.19.16.1',
    // Public tunnels, for showing the work in progress to someone off this
    // network. Wildcards because both services mint a random hostname per
    // session, so pinning one would break on the next restart. Development
    // only — `next build` ignores this key entirely, so no production origin
    // is widened by it.
    '*.trycloudflare.com',
    // `.dev` is the one ngrok actually hands out on the free tier now; the
    // others are earlier and paid-tier domains, kept so a different plan or an
    // older client does not silently produce a page that renders and never
    // hydrates.
    '*.ngrok-free.dev',
    '*.ngrok-free.app',
    '*.ngrok.app',
    '*.ngrok.io',
  ],
};

export default nextConfig;
