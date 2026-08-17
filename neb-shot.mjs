import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';
const OUT = process.argv[2] ?? 'dashboard.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"], input[name="email"]', 'student@example.com');
await page.fill('input[type="password"], input[name="password"]', 'NewEraLocal!2026');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard**', { timeout: 45_000 }).catch(() => {});
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT, fullPage: true });
console.log('url:', page.url());
await browser.close();
