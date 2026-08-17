/**
 * Redirect target validation.
 *
 * A `?next=` parameter is attacker-controlled. Accepting it unchecked turns the
 * sign-in page into an open redirect, which is the usual first step of a
 * credible phishing flow ("you really were on the site, then it sent you here").
 *
 * Only a path on this site is allowed: one leading slash, no scheme, no
 * authority, no backslash, and nothing pointing into the API surface.
 */
const DEFAULT_PATH = '/dashboard';

const MAX_LENGTH = 512;
const DEL = 127;
const SPACE = 32;

/**
 * True when the string contains a C0 control character or DEL. Checked by code
 * point rather than by a regular expression so the source file itself never
 * needs to contain a literal control character.
 */
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < SPACE || code === DEL) return true;
  }
  return false;
}

export function safeInternalPath(candidate: string | null | undefined): string | null {
  if (!candidate) return null;

  const value = candidate.trim();
  if (value.length === 0 || value.length > MAX_LENGTH) return null;

  // Must be a path on this origin.
  if (!value.startsWith('/')) return null;
  // `//host` and `/\host` are protocol-relative URLs pointing at another origin.
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  // Some clients normalise backslashes to slashes, so reject them outright.
  if (value.includes('\\')) return null;
  // A colon before the first slash would introduce a scheme.
  if (/^[^/]*:/.test(value)) return null;
  // Raw control characters, and the same characters percent-encoded.
  if (hasControlCharacter(value)) return null;
  if (/%0d|%0a|%00/i.test(value)) return null;
  // Encoded traversal into another origin.
  if (/%2f%2f/i.test(value) || /%5c/i.test(value)) return null;
  // The API is not a navigable destination.
  if (value === '/api' || value.startsWith('/api/')) return null;

  return value;
}

/** Validate a redirect target, falling back to the dashboard. */
export function safeRedirectOrDefault(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_PATH,
): string {
  return safeInternalPath(candidate) ?? fallback;
}
