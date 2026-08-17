import Link from 'next/link';

import { BrandLogoBlock } from '@/components/layout/brand';
import { Container } from '@/components/ui/surface';
import { BRAND, COPY, INDEPENDENCE_DISCLAIMER } from '@/lib/copy';

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
 * affiliated one, and it is not decoration that can be trimmed for layout.
 */
const LEGAL_LINKS = [
  { href: '/privacy', label: COPY.nav.privacy },
  { href: '/terms', label: COPY.nav.terms },
  { href: '/refund-policy', label: COPY.nav.refundPolicy },
  { href: '/contact', label: COPY.nav.contact },
] as const;

const PRODUCT_LINKS = [
  { href: '/courses', label: COPY.nav.courses },
  { href: '/simulators', label: COPY.nav.simulators },
] as const;

const LINK_CLASS =
  'text-ink-700 hover:text-brand-700 text-sm transition-colors duration-150 ease-out';

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-line-200 bg-surface mt-auto border-t">
      <Container className="py-12">
        <div className="grid gap-y-10 lg:grid-cols-[minmax(0,2fr)_1fr_1fr] lg:gap-x-16">
          <div>
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
            <p className="text-ink-700 measure-ar-sm mt-4 text-sm">{BRAND.tagline}</p>
          </div>

          <nav
            aria-label={COPY.nav.productsGroup}
            className="border-line-200 flex flex-col gap-3 lg:border-s lg:ps-16"
          >
            <h2 className="text-ink-900 text-sm font-semibold">{COPY.nav.productsGroup}</h2>
            {PRODUCT_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={LINK_CLASS}>
                {link.label}
              </Link>
            ))}
          </nav>

          <nav
            aria-label={COPY.nav.legalNavigation}
            className="border-line-200 flex flex-col gap-3 lg:border-s lg:ps-16"
          >
            <h2 className="text-ink-900 text-sm font-semibold">{COPY.nav.informationGroup}</h2>
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={LINK_CLASS}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="border-line-200 mt-10 flex flex-col gap-4 border-t pt-6">
          <p className="text-ink-700 measure-ar-lg text-sm leading-relaxed">
            {INDEPENDENCE_DISCLAIMER}
          </p>
          <p className="text-ink-600 text-sm">
            © <bdi dir="ltr">{year}</bdi> {BRAND.name}. {COPY.legal.rightsReserved}
          </p>
        </div>
      </Container>
    </footer>
  );
}
