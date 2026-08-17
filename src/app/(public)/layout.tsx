import { PublicFooter } from '@/components/layout/public-footer';
import { PublicHeader } from '@/components/layout/public-header';
import { getCurrentUser } from '@/lib/auth/guards';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // The header only changes which actions it offers, so a failure to resolve the
  // session must not take down a public page. Marketing and legal pages have to
  // stay reachable even when the database is unavailable.
  let isSignedIn = false;
  try {
    isSignedIn = (await getCurrentUser()) !== null;
  } catch {
    isSignedIn = false;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader isSignedIn={isSignedIn} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
