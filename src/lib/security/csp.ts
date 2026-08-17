/**
 * Content Security Policy.
 *
 * Every origin below is here because something concrete needs it. The list is
 * deliberately short, and each entry names what it serves, so a future addition
 * has to justify itself rather than being appended to an anonymous allowlist.
 *
 * This module is imported by `proxy.ts`, which runs outside the application's
 * server-only modules, so it deliberately depends on nothing but its inputs.
 */

/** Hosts the payment form's script and stylesheet. */
const MOYASAR_CDN = 'https://cdn.moyasar.com';
/** The payment API the browser posts card details to, directly. */
const MOYASAR_API = 'https://api.moyasar.com';
/** Serves the Bunny Player.js control library. */
const BUNNY_ASSETS = 'https://assets.mediadelivery.net';
/** Serves the Bunny video embed that plays inside an iframe. */
const BUNNY_EMBED = 'https://iframe.mediadelivery.net';
/** Bunny's CDN, which serves video thumbnails. */
const BUNNY_CDN = 'https://*.b-cdn.net';

export function buildContentSecurityPolicy(options: {
  nonce: string;
  isDevelopment: boolean;
}): string {
  const { nonce, isDevelopment } = options;

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],

    // 'strict-dynamic' is deliberately not used. It causes browsers to ignore
    // host allowlists, and the payment form and player are loaded as ordinary
    // tags rather than injected by an already-trusted script.
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      MOYASAR_CDN,
      BUNNY_ASSETS,
      // React reconstructs server stack traces with eval in development only.
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],

    // Inline styles are unavoidable here: the framework emits them, and the
    // payment form ships its own stylesheet. Inline CSS is a far weaker vector
    // than inline script, which is what the nonce above actually protects.
    'style-src': ["'self'", "'unsafe-inline'", MOYASAR_CDN],

    'img-src': ["'self'", 'data:', 'blob:', BUNNY_CDN],
    // Fonts are self-hosted by next/font, so no external font origin is needed.
    'font-src': ["'self'"],
    'media-src': ["'self'", BUNNY_CDN],

    'connect-src': [
      "'self'",
      MOYASAR_API,
      // The dev server's hot-reload socket.
      ...(isDevelopment ? ['ws:', 'wss:'] : []),
    ],

    // Only the video embed may be framed by this site.
    'frame-src': [BUNNY_EMBED],
    // Nothing may frame this site: clickjacking protection that also covers
    // browsers reading frame-ancestors rather than X-Frame-Options.
    'frame-ancestors': ["'none'"],

    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    // Restricts where a form may submit, which limits the damage of an injection.
    'form-action': ["'self'"],
  };

  const policy = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');

  // Only meaningful over HTTPS, and it would break local http development.
  return isDevelopment ? policy : `${policy}; upgrade-insecure-requests`;
}

/** Headers that carry no per-request value. */
export function staticSecurityHeaders(isProduction: boolean): Array<[string, string]> {
  const headers: Array<[string, string]> = [
    // Stop the browser guessing a content type and executing something it
    // should have downloaded.
    ['X-Content-Type-Options', 'nosniff'],
    // Send the origin to other sites, and the full path only to this one.
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    // Nothing here needs these, so they are refused rather than left available.
    [
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    ],
    ['X-Frame-Options', 'DENY'],
  ];

  if (isProduction) {
    // Two years, subdomains included. Only sent over HTTPS, so it cannot strand
    // a local http development server.
    headers.push(['Strict-Transport-Security', 'max-age=63072000; includeSubDomains']);
  }

  return headers;
}
