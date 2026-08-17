/**
 * Arabic formatting helpers.
 *
 * Money is stored as an integer number of halalas and is never converted to a
 * float: `12345 halalas` becomes `"123.45"` by splitting the integer, so no
 * amount can drift through binary floating point.
 *
 * Dates are formatted in Asia/Riyadh regardless of where the server runs, while
 * the underlying values stay UTC.
 */
export const RIYADH_TIME_ZONE = 'Asia/Riyadh';
const LOCALE = 'ar-SA';

/**
 * `ar-SA` defaults to the Islamic (Umm al-Qura) calendar. Study schedules and
 * receipts are read against the Gregorian calendar here, so it is requested
 * explicitly rather than inherited from the locale.
 */
const GREGORIAN_LOCALE = 'ar-SA-u-ca-gregory-nu-arab';

const HALALAS_PER_RIYAL = 100;

/** Split halalas into whole riyals and the remaining halalas, without floats. */
export function splitHalalas(halalas: number): { riyals: number; remainder: number } {
  const safe = Math.trunc(Math.abs(halalas));
  return {
    riyals: Math.floor(safe / HALALAS_PER_RIYAL),
    remainder: safe % HALALAS_PER_RIYAL,
  };
}

/**
 * Format an integer halala amount as Arabic currency, e.g. `١٢٣٫٤٥ ر.س.`
 * The amount reaches `Intl` as a decimal string parsed once, never as the result
 * of `halalas / 100` arithmetic on an accumulated value.
 */
export function formatHalalas(halalas: number, options?: { withCurrency?: boolean }): string {
  const withCurrency = options?.withCurrency ?? true;
  const negative = halalas < 0;
  const { riyals, remainder } = splitHalalas(halalas);
  const decimal = Number(`${riyals}.${String(remainder).padStart(2, '0')}`);

  const formatted = new Intl.NumberFormat(LOCALE, {
    style: withCurrency ? 'currency' : 'decimal',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(negative ? -decimal : decimal);

  return formatted;
}

/** Format a plain integer with Arabic-Indic digits, e.g. `١٢٠`. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** Format a ratio as an Arabic percentage, e.g. `٧٥٪`. */
export function formatPercent(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Format a date in Riyadh time, e.g. `١٧ أغسطس ٢٠٢٦`. */
export function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(GREGORIAN_LOCALE, {
    timeZone: RIYADH_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Format a date and time in Riyadh time. */
export function formatDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(GREGORIAN_LOCALE, {
    timeZone: RIYADH_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format a duration as a countdown, e.g. `٢٥:٠٠` or `١:٠٥:٠٠`.
 * Used by the exam timer, so it stays stable and monospaced-friendly.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const seconds = safe % 60;

  const pad = (n: number) => new Intl.NumberFormat(LOCALE, { minimumIntegerDigits: 2 }).format(n);

  if (hours > 0) return `${formatNumber(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Describe a duration in Arabic words, e.g. `ساعتان و٥ دقائق`. */
export function formatDurationWords(totalSeconds: number): string {
  const safe = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.round((safe % 3_600) / 60);

  const hourText =
    hours === 0
      ? ''
      : hours === 1
        ? 'ساعة'
        : hours === 2
          ? 'ساعتان'
          : hours <= 10
            ? `${formatNumber(hours)} ساعات`
            : `${formatNumber(hours)} ساعة`;

  const minuteText =
    minutes === 0
      ? ''
      : minutes === 1
        ? 'دقيقة'
        : minutes === 2
          ? 'دقيقتان'
          : minutes <= 10
            ? `${formatNumber(minutes)} دقائق`
            : `${formatNumber(minutes)} دقيقة`;

  if (hourText && minuteText) return `${hourText} و${minuteText}`;
  return hourText || minuteText || 'أقل من دقيقة';
}
