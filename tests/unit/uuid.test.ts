import { afterEach, describe, expect, it, vi } from 'vitest';

import { uuidV4 } from '@/lib/utils';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uuidV4', () => {
  it('uses the platform implementation when there is one', () => {
    expect(uuidV4()).toMatch(V4);
  });

  /*
   * The case that matters. `crypto.randomUUID` is gated behind a secure
   * context, so a deployment served over plain http — a staging box on a bare
   * IP, where no certificate is possible — has `crypto` without it. Calling it
   * there throws inside an async click handler, which surfaces as a button that
   * spins forever rather than as an error anyone can act on.
   */
  it('falls back when randomUUID is absent, as it is outside a secure context', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    expect(globalThis.crypto.randomUUID).toBeUndefined();

    expect(uuidV4()).toMatch(V4);
  });

  it('does not repeat itself', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });

    const seen = new Set(Array.from({ length: 2000 }, () => uuidV4()));
    expect(seen.size).toBe(2000);
  });
});
