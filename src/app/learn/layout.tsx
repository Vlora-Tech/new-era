import { requireUserPage } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * Gate for the learning area.
 *
 * Authentication only, with no site chrome: the lesson page keeps the student on
 * the video and the curriculum rather than offering the marketing navigation.
 */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  await requireUserPage('/dashboard/courses');
  return children;
}
