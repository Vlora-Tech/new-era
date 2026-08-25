import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * A v4 UUID that works outside a secure context.
 *
 * `crypto.randomUUID()` is gated behind a secure context: HTTPS, or localhost.
 * A deployment reached over plain http — a staging box on a bare IP, where no
 * certificate is possible — has `crypto` but no `randomUUID`, so calling it
 * throws `TypeError: crypto.randomUUID is not a function`. Inside an async
 * click handler that rejects a promise nobody awaits, which presents as a
 * button that spins forever rather than as an error.
 *
 * `crypto.getRandomValues()` carries no such restriction, so the fallback is
 * the same randomness by a different door — not a weaker id. The bytes are set
 * to version 4 and variant 1 so the result is a well-formed UUID rather than
 * merely random-looking.
 *
 * Server code should keep calling `crypto.randomUUID()` directly; Node always
 * has it.
 */
export function uuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 1

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
