import { describe, expect, it } from 'vitest';

import { safeInternalPath, safeRedirectOrDefault } from '@/lib/safe-redirect';

describe('safeInternalPath', () => {
  it('accepts ordinary internal paths', () => {
    expect(safeInternalPath('/dashboard')).toBe('/dashboard');
    expect(safeInternalPath('/dashboard/orders')).toBe('/dashboard/orders');
    expect(safeInternalPath('/exam/8f1d?section=2')).toBe('/exam/8f1d?section=2');
  });

  it('keeps hyphenated slugs, which a control-character check must not eat', () => {
    expect(safeInternalPath('/simulators/qudurat-general-scientific')).toBe(
      '/simulators/qudurat-general-scientific',
    );
    expect(safeInternalPath('/courses/verbal-skills-101')).toBe('/courses/verbal-skills-101');
  });

  it('accepts percent-encoded Arabic slugs', () => {
    const arabicPath = `/courses/${encodeURIComponent('دورة-القدرات')}`;
    expect(safeInternalPath(arabicPath)).toBe(arabicPath);
  });

  it('rejects absolute URLs pointing at another origin', () => {
    expect(safeInternalPath('https://evil.example/login')).toBeNull();
    expect(safeInternalPath('http://evil.example')).toBeNull();
    expect(safeInternalPath('//evil.example')).toBeNull();
    expect(safeInternalPath('javascript:alert(1)')).toBeNull();
    expect(safeInternalPath('data:text/html,<script>')).toBeNull();
  });

  it('rejects backslash and encoded-slash tricks', () => {
    expect(safeInternalPath('/\\evil.example')).toBeNull();
    expect(safeInternalPath('/path\\to')).toBeNull();
    expect(safeInternalPath('/%2f%2fevil.example')).toBeNull();
    expect(safeInternalPath('/%5cevil.example')).toBeNull();
  });

  it('rejects header-splitting characters', () => {
    expect(safeInternalPath('/dashboard\nSet-Cookie: a=b')).toBeNull();
    expect(safeInternalPath('/dashboard\r\nLocation: https://evil.example')).toBeNull();
    expect(safeInternalPath('/dashboard%0d%0aSet-Cookie:%20a=b')).toBeNull();
  });

  it('rejects the API surface and malformed input', () => {
    expect(safeInternalPath('/api/auth/login')).toBeNull();
    expect(safeInternalPath('/api')).toBeNull();
    expect(safeInternalPath('dashboard')).toBeNull();
    expect(safeInternalPath('')).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
    expect(safeInternalPath(`/${'a'.repeat(600)}`)).toBeNull();
  });
});

describe('safeRedirectOrDefault', () => {
  it('falls back to the dashboard for a hostile target', () => {
    expect(safeRedirectOrDefault('https://evil.example')).toBe('/dashboard');
    expect(safeRedirectOrDefault(null)).toBe('/dashboard');
  });

  it('honours an explicit fallback', () => {
    expect(safeRedirectOrDefault(null, '/courses')).toBe('/courses');
  });

  it('passes a safe target through', () => {
    expect(safeRedirectOrDefault('/dashboard/orders')).toBe('/dashboard/orders');
  });
});
