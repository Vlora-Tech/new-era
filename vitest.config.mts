import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` exists to fail the build when a server module is pulled
      // into a client bundle. Under Vitest there is no such bundle, and its
      // client entrypoint throws on import, so it is stubbed out. The protection
      // it provides still applies where it matters: `next build`.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    // Node by default; component tests opt in with `@vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Playwright drives the e2e suite; Vitest must not try to run those files.
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
