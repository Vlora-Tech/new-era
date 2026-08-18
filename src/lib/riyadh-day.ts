/**
 * Riyadh calendar days, in one place.
 *
 * A day named by an administrator — "الطلبات في ٥ فبراير" — is a pair of
 * instants, and which pair depends on the zone the person naming it lives in.
 * Saudi Arabia observes `UTC+03:00` all year with no daylight saving, so the
 * conversion is exact arithmetic rather than a zone-database lookup: an order
 * placed at 01:00 Riyadh on the 5th is stored as 22:00 UTC on the 4th, and a
 * UTC-boundary "from the 5th" would hide it from a report about the 5th.
 *
 * This module exists because that arithmetic had been written three times — once
 * in `student-admin.service.ts`, once in `validators/admin-order.ts`, once in
 * `validators/admin-audit.ts` — each with its own copy of the offset and its own
 * answer to what `2026-02-31` means. Three implementations of one rule is three
 * chances for a filter to disagree with the screen above it, and it had already
 * produced a cross-domain import: the entitlements list reached into the student
 * administration service for a date helper.
 *
 * Deliberately not `server-only`: this is pure arithmetic over strings, and the
 * filter bars are client components that redraw the day a reader chose.
 *
 * `startOfRiyadhDay` and `endOfRiyadhDay` **throw** on a day they cannot honour
 * rather than returning an `Invalid Date`. That is the whole point of moving
 * them here. An `Invalid Date` reaches Prisma as `null`, which silently *widens*
 * a filter to everything — a "from the 31st of February" that returns the entire
 * table looks like a working screen. Callers validate the string with
 * `isRiyadhDay` first; a throw past that guard is a programming fault and is
 * reported as one.
 */

/** `YYYY-MM-DD`, as an `<input type="date">` submits it. */
export const RIYADH_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Saudi Arabia is `UTC+03:00` year-round; no daylight saving to track. */
export const RIYADH_UTC_OFFSET = '+03:00';

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1_000;

/**
 * True when the string names a real calendar day.
 *
 * The pattern alone is not enough: `2026-02-31` matches it, and the round trip
 * through `toISOString()` is what rejects a day that does not exist. Every
 * schema that accepts a day from a query string refines on this *before*
 * transforming, so the constructors below never see a string they must refuse.
 */
export function isRiyadhDay(value: string): boolean {
  if (!RIYADH_DAY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function assertDay(day: string): void {
  if (!isRiyadhDay(day)) {
    throw new RangeError(`not a Riyadh calendar day: ${day}`);
  }
}

/** The first instant of the named day, in Riyadh. */
export function startOfRiyadhDay(day: string): Date {
  assertDay(day);
  return new Date(`${day}T00:00:00.000${RIYADH_UTC_OFFSET}`);
}

/**
 * The last instant of the named day, in Riyadh.
 *
 * Closed at both ends: `to=2026-08-17` includes everything that happened on the
 * seventeenth, because a range that excluded the day it names would be read as a
 * bug by every person who used it.
 */
export function endOfRiyadhDay(day: string): Date {
  assertDay(day);
  return new Date(`${day}T23:59:59.999${RIYADH_UTC_OFFSET}`);
}

/**
 * The inverse: an instant back to the `YYYY-MM-DD` an `<input type="date">`
 * wants, so a filter form can redraw the day the reader actually chose.
 */
export function riyadhDateInput(value: Date): string {
  return new Date(value.getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}
