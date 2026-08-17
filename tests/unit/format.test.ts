import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  formatDurationWords,
  formatHalalas,
  formatNumber,
  splitHalalas,
} from '@/lib/format';

describe('splitHalalas', () => {
  it('splits without floating point arithmetic', () => {
    expect(splitHalalas(0)).toEqual({ riyals: 0, remainder: 0 });
    expect(splitHalalas(5)).toEqual({ riyals: 0, remainder: 5 });
    expect(splitHalalas(100)).toEqual({ riyals: 1, remainder: 0 });
    expect(splitHalalas(12_345)).toEqual({ riyals: 123, remainder: 45 });
    expect(splitHalalas(99_999_999)).toEqual({ riyals: 999_999, remainder: 99 });
  });

  it('handles the amounts that break naive division', () => {
    // 0.1 + 0.2 style errors: these must be exact.
    expect(splitHalalas(1_010)).toEqual({ riyals: 10, remainder: 10 });
    expect(splitHalalas(2_999)).toEqual({ riyals: 29, remainder: 99 });
    expect(splitHalalas(70)).toEqual({ riyals: 0, remainder: 70 });
  });
});

describe('formatHalalas', () => {
  it('renders SAR amounts with two fraction digits', () => {
    const formatted = formatHalalas(12_345);
    expect(formatted).toContain('١٢٣');
    expect(formatted).toContain('٤٥');
  });

  it('never renders a rounding artefact', () => {
    // 1999 halalas is exactly 19.99 riyals, not 19.990000000000002.
    const formatted = formatHalalas(1_999, { withCurrency: false });
    expect(formatted).not.toContain('0000');
  });

  it('formats zero', () => {
    expect(formatHalalas(0, { withCurrency: false })).toContain('٠');
  });
});

describe('formatNumber', () => {
  it('uses Arabic-Indic digits', () => {
    expect(formatNumber(120)).toBe('١٢٠');
    expect(formatNumber(24)).toBe('٢٤');
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(1_500)).toBe('٢٥:٠٠');
    expect(formatDuration(65)).toBe('٠١:٠٥');
    expect(formatDuration(0)).toBe('٠٠:٠٠');
  });

  it('formats hours when present', () => {
    // The official guide total: 2 hours 5 minutes.
    expect(formatDuration(7_500)).toBe('٢:٠٥:٠٠');
  });

  it('clamps negative input to zero rather than rendering a negative timer', () => {
    expect(formatDuration(-30)).toBe('٠٠:٠٠');
  });
});

describe('formatDurationWords', () => {
  it('uses Arabic dual and plural forms correctly', () => {
    expect(formatDurationWords(3_600)).toBe('ساعة');
    expect(formatDurationWords(7_200)).toBe('ساعتان');
    expect(formatDurationWords(120)).toBe('دقيقتان');
    expect(formatDurationWords(7_500)).toBe('ساعتان و٥ دقائق');
  });

  it('describes a very short duration', () => {
    expect(formatDurationWords(10)).toBe('أقل من دقيقة');
  });
});
