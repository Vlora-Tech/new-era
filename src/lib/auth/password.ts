import 'server-only';

import bcrypt from 'bcryptjs';

import { AUTH } from '@/lib/constants';

/**
 * A bcrypt hash of a fixed string, used to spend comparable time when no user
 * matches. Without it, "unknown address" would return measurably faster than
 * "wrong password", which turns the login form into an account-existence oracle.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.Nl5Q1QeYYqLWiJ1kxs0ZTMk6EDNo9Zy';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, AUTH.PASSWORD_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Spend the same work as a real comparison when there is no user to compare. */
export async function spendDummyComparison(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH);
}
