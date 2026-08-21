import Link from 'next/link';

import { BrandLogoBlock } from '@/components/layout/brand';
import { Container } from '@/components/ui/surface';
import { BRAND, COPY, INDEPENDENCE_DISCLAIMER } from '@/lib/copy';

import { IconInfo, IconMail } from '@/components/landing/icons';

/**
 * Public footer.
 *
 * One of the few placements with enough room for the supplied logo at its
 * required 220px, on white, with the clear space the guidelines ask for — and
 * with the plate pulled flush on the inline-start axis so the artwork's edge,
 * not its padding box, sits on the container's grid.
 *
 * The independence disclaimer sits here on every public page. It is a standing
 * statement that this is an independent training product, not an official or
 * affiliated one, and it is not decoration that can be trimmed for layout. The
 * 2026 design adds a short form of it in a tinted strip; that strip is an
 * introduction to the full statement below it, never a replacement.
 *
 * ── The social row ─────────────────────────────────────────────────────────
 *
 * The design draws four social buttons — mail, chat, video, web. Only the first
 * has anywhere to go: the platform has no accounts on any network yet. The row
 * is therefore built from `SOCIAL_LINKS`, which currently holds one entry, so
 * nothing renders as a dead link. Adding the accounts is adding rows to that
 * array — the icons are already mapped in `landing/icons.ts`.
 */
const SOCIAL_LINKS = [
  { href: '/contact', label: COPY.landing.footer.contactAction, icon: IconMail },
] as const;

const PLATFORM_LINKS = [
  { href: '/courses', label: COPY.nav.courses },
  { href: '/simulators', label: COPY.nav.simulators },
  { href: '/login', label: COPY.nav.login },
] as const;

const HELP_LINKS = [
  { href: '/#faq', label: COPY.nav.faq },
  { href: '/contact', label: COPY.nav.contact },
] as const;

/**
 * The canvas's third column is «حقوق المحتوى», which has no page behind it. It
 * used to point at a band on the landing page; the 2026 canvas does not draw
 * that band, so there is now nowhere at all for the label to go. The refund
 * policy takes the slot instead: it is a real page, it is the one policy a
 * buyer looks for, and shipping a link to nowhere to preserve a label would be
 * the wrong trade.
 */
const POLICY_LINKS = [
  { href: '/privacy', label: COPY.nav.privacy },
  { href: '/terms', label: COPY.nav.terms },
  { href: '/refund-policy', label: COPY.nav.refundPolicy },
] as const;

/**
 * A footer link is small and set on white, so hover cannot rest on colour
 * alone: the underline is the second signal, and the offset keeps it clear of
 * the Arabic descenders. The focus ring is drawn here rather than inherited,
 * because a bare `<a>` has none.
 */
const LINK_CLASS = [
  'text-ink-700 hover:text-brand-700 text-sm transition-colors duration-150 ease-out',
  'rounded-control hover:underline underline-offset-4 decoration-1',
  'focus-visible:outline-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2',
].join(' ');

/**
 * Arabic has no case, so the label register that Latin footers get from small
 * caps has to come from the face instead: the canvas sets these in the display
 * family at 16px/600, a step ABOVE the links they head rather than below them.
 * Every column uses it, which is what makes them read as one system.
 */
const COLUMN_HEADING_CLASS = 'font-display text-ink-900 mb-1 text-[16px] font-semibold';

function LinkColumn({
  heading,
  links,
}: {
  heading: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <nav aria-label={heading} className="flex flex-col gap-3">
      <h2 className={COLUMN_HEADING_CLASS}>{heading}</h2>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={LINK_CLASS}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();
  const FOOTER = COPY.landing.footer;

  return (
    <footer className="border-line-200 bg-surface mt-auto border-t">
      <Container className="relative py-14 lg:py-16">
        {/*
         * The site's ruled tick, standing on the footer's own top border the way
         * every page head stands on its rule — the document closes on the figure
         * it opens with. `-top-px` puts the bar's top edge on the border's.
         */}
        <span
          aria-hidden="true"
          className="bg-gradient-brand absolute start-4 -top-px block h-[3px] w-16 sm:start-6 lg:start-8"
        />

        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr] lg:gap-x-12">
          <div className="sm:col-span-2 lg:col-span-1">
            {/*
             * `flex` removes the inline strut under the plate; `overflow-x-clip`
             * absorbs the flush pull, whose 28px is wider than the 16/24px
             * gutters below `lg`. Only white padding on a white ground is
             * clipped, so the artwork itself is untouched and still starts on
             * the container's content edge.
             */}
            <div className="flex overflow-x-clip">
              <BrandLogoBlock width={220} flush />
            </div>
            <p className="text-ink-700 measure-ar-sm mt-4 text-[15px] leading-[1.8]">
              {FOOTER.description}
            </p>

            <div className="mt-5 flex items-center gap-2.5">
              {SOCIAL_LINKS.map((social) => (
                <Link
                  key={social.href}
                  href={social.href}
                  aria-label={social.label}
                  className="border-line-200 text-ink-700 hover:border-brand-500/40 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-brand-700 flex size-10 items-center justify-center rounded-full border transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <social.icon className="size-4.5" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <LinkColumn heading={FOOTER.platformGroup} links={PLATFORM_LINKS} />
          <LinkColumn heading={FOOTER.helpGroup} links={HELP_LINKS} />
          <LinkColumn heading={FOOTER.policiesGroup} links={POLICY_LINKS} />
        </div>

        <div className="mt-11 flex flex-col gap-4">
          <p className="rounded-panel border-line-200 text-ink-700 from-brand-50 flex items-start gap-2.5 border bg-linear-to-l to-white px-5 py-4 text-sm leading-relaxed">
            <IconInfo className="text-ink-500 mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>{FOOTER.disclaimerStrip}</span>
          </p>

          <p className="text-ink-700 measure-ar-lg text-sm leading-relaxed">
            {INDEPENDENCE_DISCLAIMER}
          </p>
        </div>

        {/*
         * The wordmark, set enormous and nearly the colour of the page.
         *
         * It is the canvas's closing device: the brand name as a watermark
         * rather than a mark, at `clamp(40px, 9vw, 132px)` in `surface-muted`.
         * `aria-hidden` and `select-none` because it is texture — the real
         * lockup is at the top of this footer and the name is already in the
         * copyright line below, so announcing it a third time is noise.
         *
         * `overflow-hidden` on the wrapper is load-bearing: at 132px the string
         * is wider than the container on anything under about 1500px, and
         * `whitespace-nowrap` would otherwise scroll the whole page sideways.
         */}
        <div className="mt-10 overflow-hidden">
          <p
            aria-hidden="true"
            className="font-display text-surface-muted text-end text-[clamp(40px,9vw,132px)] leading-none font-bold tracking-[-0.04em] whitespace-nowrap select-none"
          >
            {BRAND.name}
          </p>
        </div>

        <div className="border-line-200 text-ink-600 mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-sm">
          <p>
            © <bdi dir="ltr">{year}</bdi> {BRAND.name}. {COPY.legal.rightsReserved}
          </p>
          <p>{FOOTER.madeIn}</p>
        </div>
      </Container>
    </footer>
  );
}
