import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The suite drives a real server against the development database. Port 3100 is
 * used rather than 3000 so a running `npm run dev` — or anything else already
 * holding the usual port — does not collide with a test run.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Clears rate-limit counters so the suite can register several accounts from
  // one address without weakening the production budget it is testing against.
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : [['list']],

  use: {
    baseURL,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The brief requires mobile to be designed rather than merely collapsed, so
    // the critical paths are exercised at a phone viewport too.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // The origin check compares against this, so it must match the test port.
    env: { NEXT_PUBLIC_APP_URL: baseURL },
  },
});
