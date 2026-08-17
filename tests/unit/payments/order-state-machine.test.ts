import type { OrderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { canTransitionOrder, ORDER_TRANSITIONS } from '@/services/payments/order.service';

const ALL_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'];

describe('order state machine', () => {
  it('lets a pending order settle, fail or be cancelled', () => {
    expect(canTransitionOrder('PENDING_PAYMENT', 'PAID')).toBe(true);
    expect(canTransitionOrder('PENDING_PAYMENT', 'FAILED')).toBe(true);
    expect(canTransitionOrder('PENDING_PAYMENT', 'CANCELLED')).toBe(true);
  });

  it('lets a late webhook rescue a failed order', () => {
    expect(canTransitionOrder('FAILED', 'PAID')).toBe(true);
  });

  it('never downgrades a paid order to failed or cancelled', () => {
    expect(canTransitionOrder('PAID', 'FAILED')).toBe(false);
    expect(canTransitionOrder('PAID', 'CANCELLED')).toBe(false);
  });

  it('allows only a refund out of a paid order', () => {
    expect(ORDER_TRANSITIONS.PAID).toEqual(['REFUNDED']);
  });

  it('treats refunded and cancelled as terminal', () => {
    for (const target of ALL_STATUSES) {
      expect(canTransitionOrder('REFUNDED', target)).toBe(false);
      expect(canTransitionOrder('CANCELLED', target)).toBe(false);
    }
  });

  it('does not report a state as a transition into itself', () => {
    for (const status of ALL_STATUSES) {
      expect(canTransitionOrder(status, status)).toBe(false);
    }
  });

  it('rejects every pair the table does not list', () => {
    for (const from of ALL_STATUSES) {
      const allowed = new Set<OrderStatus>(ORDER_TRANSITIONS[from]);
      for (const to of ALL_STATUSES) {
        expect(canTransitionOrder(from, to)).toBe(allowed.has(to));
      }
    }
  });
});
