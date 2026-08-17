import { expect, test } from '@playwright/test';

/**
 * A Content-Security-Policy is easy to set and easy to get subtly wrong: a
 * missing origin does not fail a build, it silently breaks a feature in the
 * browser. These tests read the policy and then watch a real browser render
 * under it.
 */
const PAGES = ['/', '/courses', '/simulators', '/login', '/register', '/terms'];

function parsePolicy(header: string): Map<string, string[]> {
  return new Map(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [directive, ...values] = part.split(/\s+/);
        return [directive!, values] as const;
      }),
  );
}

test.describe('security headers', () => {
  test('every page carries the policy and the hardening headers', async ({ request }) => {
    for (const path of PAGES) {
      const response = await request.get(path);
      const headers = response.headers();

      expect(headers['content-security-policy'], `missing CSP on ${path}`).toBeTruthy();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['permissions-policy']).toContain('camera=()');
    }
  });

  test('the policy names only the origins the product actually uses', async ({ request }) => {
    const response = await request.get('/');
    const directives = parsePolicy(response.headers()['content-security-policy'] ?? '');

    // Nothing may frame this site, and only the video embed may be framed by it.
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.get('frame-src')).toEqual(['https://iframe.mediadelivery.net']);

    // Card details go from the browser straight to the payment API.
    expect(directives.get('connect-src')).toContain('https://api.moyasar.com');

    // Plugins and base-tag injection are refused outright.
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);

    const scriptSrc = directives.get('script-src') ?? [];
    expect(scriptSrc.some((value) => value.startsWith("'nonce-"))).toBe(true);
    // A blanket inline allowance would defeat the nonce entirely.
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  test('the nonce is fresh on every request', async ({ request }) => {
    const first = parsePolicy((await request.get('/')).headers()['content-security-policy'] ?? '');
    const second = parsePolicy((await request.get('/')).headers()['content-security-policy'] ?? '');

    const nonceOf = (directives: Map<string, string[]>) =>
      (directives.get('script-src') ?? []).find((value) => value.startsWith("'nonce-"));

    expect(nonceOf(first)).toBeTruthy();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });

  test('no page reports a violation while rendering', async ({ page }) => {
    const violations: string[] = [];

    // Both channels matter: the browser reports a blocked resource as a console
    // error, and a blocked inline script as a securitypolicyviolation event.
    page.on('console', (message) => {
      const text = message.text();
      if (/content security policy/i.test(text)) violations.push(text);
    });

    // Registered through Playwright's privileged channel rather than injected as
    // a script tag: an injected inline script is exactly what the policy blocks,
    // so the probe would be the first thing to fail.
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(
          `Content Security Policy violation: ${event.violatedDirective} blocked ${event.blockedURI}`,
        );
      });
    });

    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }

    expect(violations, `CSP violations:\n${violations.join('\n')}`).toEqual([]);
  });
});
