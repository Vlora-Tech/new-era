import { describe, expect, it } from 'vitest';

import {
  ACCESS_RULES,
  classifyRefund,
  decideAccess,
  isKnownPaymentStatus,
  normalizePaymentStatus,
  UnknownPaymentStatusError,
} from '@/services/payments/moyasar-status';

describe('normalizePaymentStatus', () => {
  it.each([
    ['initiated', 'INITIATED'],
    ['paid', 'PAID'],
    ['failed', 'FAILED'],
    ['authorized', 'AUTHORIZED'],
    ['captured', 'CAPTURED'],
    ['verified', 'VERIFIED'],
    ['refunded', 'REFUNDED'],
    ['voided', 'VOIDED'],
  ])('maps %s to %s', (raw, expected) => {
    expect(normalizePaymentStatus(raw)).toBe(expected);
  });

  it('accepts surrounding whitespace and unexpected casing', () => {
    expect(normalizePaymentStatus('  PAID ')).toBe('PAID');
  });

  it('throws a typed error for a status it does not model', () => {
    expect(() => normalizePaymentStatus('settled')).toThrow(UnknownPaymentStatusError);
    expect(() => normalizePaymentStatus('')).toThrow(UnknownPaymentStatusError);
  });

  it('does not accept the local CREATED status from a provider', () => {
    expect(isKnownPaymentStatus('created')).toBe(false);
  });
});

describe('access rules', () => {
  it('opens access for a paid payment only', () => {
    const granting = Object.entries(ACCESS_RULES)
      .filter(([, rule]) => rule === 'GRANT')
      .map(([status]) => status);
    expect(granting).toEqual(['PAID']);
  });

  it.each(['INITIATED', 'AUTHORIZED', 'VERIFIED', 'CAPTURED', 'FAILED'] as const)(
    'leaves access closed for %s',
    (status) => {
      expect(decideAccess(status, 10_000, 0)).toEqual({
        access: 'NONE',
        needsReview: false,
        reviewReason: null,
      });
    },
  );

  it('grants for a clean paid payment', () => {
    expect(decideAccess('PAID', 10_000, 0)).toEqual({
      access: 'GRANT',
      needsReview: false,
      reviewReason: null,
    });
  });

  it('revokes for a fully refunded payment', () => {
    expect(decideAccess('REFUNDED', 10_000, 10_000).access).toBe('REVOKE');
  });

  it('revokes for a void regardless of the refunded amount', () => {
    expect(decideAccess('VOIDED', 10_000, 0).access).toBe('REVOKE');
    expect(decideAccess('VOIDED', 10_000, 10_000).access).toBe('REVOKE');
  });

  it('never revokes automatically for a partial refund', () => {
    const refunded = decideAccess('REFUNDED', 10_000, 2_500);
    expect(refunded.access).toBe('NONE');
    expect(refunded.needsReview).toBe(true);

    const stillPaid = decideAccess('PAID', 10_000, 2_500);
    expect(stillPaid.access).not.toBe('REVOKE');
    expect(stillPaid.needsReview).toBe(true);
  });

  it('flags a refunded status that reports nothing returned', () => {
    expect(decideAccess('REFUNDED', 10_000, 0)).toMatchObject({
      access: 'NONE',
      needsReview: true,
    });
  });
});

describe('classifyRefund', () => {
  it('treats nothing returned as no refund', () => {
    expect(classifyRefund(10_000, 0)).toBe('NONE');
  });

  it('treats an over-refund as a full refund', () => {
    expect(classifyRefund(10_000, 12_000)).toBe('FULL');
  });

  it('treats any smaller amount as partial', () => {
    expect(classifyRefund(10_000, 1)).toBe('PARTIAL');
    expect(classifyRefund(10_000, 9_999)).toBe('PARTIAL');
  });
});
