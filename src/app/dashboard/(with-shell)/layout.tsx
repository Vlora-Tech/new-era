import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requireUserPage } from '@/lib/auth/guards';
import { ROUTES } from '@/lib/constants';

/**
 * Chrome for the browsable part of the student area.
 *
 * The guard above has already established that there is a user; calling it
 * again is how this layout obtains the name without widening the parent's
 * contract, and `getCurrentUser` is memoized for the render, so it costs no
 * second query.
 */
export default async function DashboardWithShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserPage(ROUTES.dashboard);

  return <DashboardShell userName={user.name}>{children}</DashboardShell>;
}
