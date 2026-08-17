import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';

/**
 * The student area's authentication gate, and nothing else.
 *
 * The split into two layers is deliberate. `/learn` and `/exam` will be
 * full-screen surfaces: a lesson player and a timed attempt both need the whole
 * viewport, and a navigation rail beside a running exam is an invitation to
 * leave it. Keeping the gate here and the chrome one level down in
 * `(with-shell)` lets those routes be moved under this layout later and inherit
 * the session check without inheriting a sidebar.
 *
 * `proxy.ts` has already turned away requests with no session cookie, but it
 * cannot see a blocked account or a retired session version. This is the check
 * that runs against the database, so it must never be cached.
 */
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage(ROUTES.dashboard);
  return <>{children}</>;
}
