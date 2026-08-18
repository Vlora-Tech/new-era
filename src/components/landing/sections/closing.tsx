import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/surface';
import { COPY } from '@/lib/copy';

import { IconForward } from '../icons';
import { revealDelay } from '../parts';

/**
 * The closing band.
 *
 * The page's last word, and the only place besides the hero where the primary
 * action is the largest object in its own column — which is what the `xl`
 * button size exists for. The band's tinted gradient is the second and final
 * sanctioned full-bleed ground on this page.
 */
const CLOSING = COPY.landing.closing;

export function Closing() {
  return (
    <section className="via-brand-100 to-brand-50 relative overflow-hidden bg-linear-to-b from-white py-20 sm:py-24 lg:py-32">
      <span aria-hidden="true" className="bg-grid-fade absolute inset-0 opacity-60" />

      <Container className="relative text-center">
        <h2 className="text-ink-900 text-h1 reveal">{CLOSING.title}</h2>
        <p
          className="text-ink-700 text-lead measure-ar-lg reveal mx-auto mt-5"
          style={revealDelay(70)}
        >
          {CLOSING.lead}
        </p>

        <div
          className="reveal mt-10 flex flex-wrap items-center justify-center gap-3.5"
          style={revealDelay(130)}
        >
          <Button asChild variant="gradient" shape="pill" size="xl">
            <Link href="/register">
              {CLOSING.ctaPrimary}
              <IconForward className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" shape="pill" size="xl">
            <Link href="/courses">{CLOSING.ctaSecondary}</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
