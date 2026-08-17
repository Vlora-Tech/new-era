import type { ReactNode } from 'react';

import { AdminShell } from '@/components/layout/admin-shell';
import { requireAdminPage } from '@/lib/auth/guards';

/**
 * The framed part of the administration area.
 *
 * Calling the guard again is not a second query: `getCurrentUser` is memoised
 * per request with React's `cache`, so this reuses the row the parent layout
 * already fetched, and returns it typed as non-null without a cast.
 */
export default async function AdminWithShellLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage('/admin');

  return <AdminShell user={{ name: user.name, email: user.email }}>{children}</AdminShell>;
}
