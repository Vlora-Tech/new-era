import type { ReactNode } from 'react';

import { requireUserPage } from '@/lib/auth/guards';

/**
 * Bare full-screen shell for a live attempt.
 *
 * Deliberately carries no site header, no sidebar and no footer. A running exam
 * is a modal state: every navigation control on the screen is an invitation to
 * leave a section whose clock does not stop, and a student who clicks "دوراتي"
 * out of habit has lost time they cannot get back. The only way out is the
 * workspace's own exit control, which explains the consequence first.
 *
 * `proxy.ts` already matches `/exam/:path*`, but it can only check a cookie
 * signature. This is the gate that runs against the database, so it must never
 * be cached.
 */
export const dynamic = 'force-dynamic';

export default async function ExamAttemptLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  await requireUserPage(`/exam/${attemptId}`);

  return <div className="bg-canvas min-h-dvh">{children}</div>;
}
