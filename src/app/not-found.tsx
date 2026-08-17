import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { COPY } from '@/lib/copy';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="text-brand-700 text-sm font-medium">٤٠٤</p>
      <h1 className="text-ink-900 text-3xl font-semibold">{COPY.errors.notFound}</h1>
      <p className="text-ink-700 max-w-md">{COPY.errors.notFoundBody}</p>
      <Button asChild>
        <Link href="/">{COPY.errors.notFoundAction}</Link>
      </Button>
    </main>
  );
}
