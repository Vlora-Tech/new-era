import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The mock-in-production guard.
 *
 * `env()` already refuses to parse a production configuration that selects the
 * mock, which means the factory's own gate can never be reached through the real
 * environment parser — so it is exercised here against a stubbed `env()`. That is
 * the point of having two: if the parser is ever relaxed, this gate still holds.
 */
const state = vi.hoisted(() => ({
  paymentProvider: 'mock' as 'mock' | 'moyasar',
}));

vi.mock('@/lib/env', () => ({
  env: () => ({
    PAYMENT_PROVIDER: state.paymentProvider,
    MOYASAR_MODE: 'test',
    MOYASAR_API_BASE_URL: 'https://api.moyasar.test',
    MOYASAR_SECRET_KEY: 'sk_test_stub',
    NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY: 'pk_test_stub',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    NODE_ENV: 'production',
  }),
  isCommerceEnabled: () => true,
}));

import { configuredProviderName, getPaymentProvider } from '@/services/payments/payment-provider';

const mutableEnv = process.env as Record<string, string | undefined>;
const originalNodeEnv = mutableEnv.NODE_ENV;

afterEach(() => {
  mutableEnv.NODE_ENV = originalNodeEnv;
  state.paymentProvider = 'mock';
});

describe('getPaymentProvider', () => {
  it('refuses to hand out the mock adapter in production', () => {
    mutableEnv.NODE_ENV = 'production';
    expect(() => getPaymentProvider()).toThrow(/mock payment provider/i);
  });

  it('returns the mock adapter outside production', () => {
    mutableEnv.NODE_ENV = 'test';
    expect(getPaymentProvider().name).toBe('MOCK');
  });

  it('returns the Moyasar adapter in production when it is configured', () => {
    mutableEnv.NODE_ENV = 'production';
    state.paymentProvider = 'moyasar';
    expect(getPaymentProvider().name).toBe('MOYASAR');
  });

  it('maps the configuration value onto the database provider enum', () => {
    expect(configuredProviderName()).toBe('MOCK');
    state.paymentProvider = 'moyasar';
    expect(configuredProviderName()).toBe('MOYASAR');
  });
});
