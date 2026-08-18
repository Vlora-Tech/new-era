import { describe, expect, it } from 'vitest';

import { endOfRiyadhDay, isRiyadhDay, riyadhDateInput, startOfRiyadhDay } from '@/lib/riyadh-day';
import { entitlementListQuerySchema } from '@/validators/admin-entitlement';
import { auditLogQuerySchema } from '@/validators/admin-audit';
import { orderListQuerySchema } from '@/validators/admin-order';

/**
 * One definition of "a day in Riyadh", asserted once.
 *
 * The arithmetic used to exist three times — in the student service, in the
 * order validator and in the audit validator — each with its own copy of the
 * offset and its own answer to `2026-02-31`. The last of those was the real
 * hazard: an `Invalid Date` reaches Prisma as `null`, which does not narrow a
 * filter, it *removes* it. A report "from the 31st of February" that quietly
 * returned the entire table looks like a working screen.
 */
describe('riyadh day boundaries', () => {
  it('opens and closes the day at the Riyadh offset, not at UTC midnight', () => {
    // 00:00 on the 5th in Riyadh is 21:00 on the 4th in UTC. An order placed at
    // 01:00 local on the 5th must be inside "from the 5th".
    expect(startOfRiyadhDay('2026-02-05').toISOString()).toBe('2026-02-04T21:00:00.000Z');
    expect(endOfRiyadhDay('2026-02-05').toISOString()).toBe('2026-02-05T20:59:59.999Z');
  });

  it('closes the range on the day it names', () => {
    const start = startOfRiyadhDay('2026-02-05');
    const end = endOfRiyadhDay('2026-02-05');
    // 23:59 local on the named day is still inside it.
    expect(new Date('2026-02-05T23:59:00.000+03:00') <= end).toBe(true);
    expect(new Date('2026-02-05T00:00:00.000+03:00') >= start).toBe(true);
    expect(new Date('2026-02-06T00:00:00.000+03:00') > end).toBe(true);
  });

  it('round-trips an instant back to the day an <input type="date"> wants', () => {
    // 22:00 UTC is already the following day in Riyadh, which is the case a
    // naive `toISOString().slice(0, 10)` gets wrong.
    expect(riyadhDateInput(new Date('2026-02-04T22:00:00.000Z'))).toBe('2026-02-05');
    expect(riyadhDateInput(startOfRiyadhDay('2026-02-05'))).toBe('2026-02-05');
  });

  it('rejects a day that does not exist rather than producing an Invalid Date', () => {
    expect(isRiyadhDay('2026-02-31')).toBe(false);
    expect(isRiyadhDay('2026-13-01')).toBe(false);
    expect(isRiyadhDay('05-02-2026')).toBe(false);
    expect(isRiyadhDay('2026-02-05')).toBe(true);

    // Throwing is the point: silently widening a filter is the failure mode this
    // module exists to prevent.
    expect(() => startOfRiyadhDay('2026-02-31')).toThrow(RangeError);
    expect(() => endOfRiyadhDay('2026-02-31')).toThrow(RangeError);
  });

  /**
   * The three query schemas that read a day off the query string must all reach
   * the same verdict, and none may throw: a browsing surface answers `?to=junk`
   * by ignoring it, never with a 500.
   */
  it('is applied identically by the order, audit and entitlement filters', () => {
    expect(orderListQuerySchema.parse({ from: '2026-02-31' }).from).toBeUndefined();
    expect(auditLogQuerySchema.parse({ to: '2026-02-31' }).to).toBeUndefined();
    expect(entitlementListQuerySchema.parse({ from: '2026-02-31' }).from).toBeUndefined();

    expect(orderListQuerySchema.parse({ from: '2026-02-05' }).from?.toISOString()).toBe(
      '2026-02-04T21:00:00.000Z',
    );
    expect(auditLogQuerySchema.parse({ from: '2026-02-05' }).from?.toISOString()).toBe(
      '2026-02-04T21:00:00.000Z',
    );
    // The entitlement filter keeps the string and converts in the service, so
    // the assertion is that the service's conversion agrees.
    expect(
      startOfRiyadhDay(entitlementListQuerySchema.parse({ from: '2026-02-05' }).from!),
    ).toEqual(orderListQuerySchema.parse({ from: '2026-02-05' }).from);
  });
});
