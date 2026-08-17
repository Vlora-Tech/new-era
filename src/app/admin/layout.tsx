import type { ReactNode } from 'react';

import { requireAdminPage } from '@/lib/auth/guards';

/**
 * The gate for everything under `/admin`.
 *
 * It renders no chrome on purpose. Authorization sits in its own layout so a
 * future route group that needs a different frame — a full-screen editor, a
 * print view — still inherits the same check rather than re-implementing it.
 *
 * `proxy.ts` has already turned away requests with no session cookie, but that
 * check is a signature check against a token and cannot see a role change or a
 * blocked account. This one queries the database, and is the actual gate.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage('/admin');
  return children;
}
