import Link from 'next/link';

import { BrandLogoBlock } from '@/components/layout/brand';
import { Container } from '@/components/ui/surface';
import { BRAND, COPY, INDEPENDENCE_DISCLAIMER } from '@/lib/copy';

/**
 * Public footer.
 *
 * One of the few placements with enough room for the supplied logo at its
 * required size, on white, with clear space.
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

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-line-200 bg-surface mt-auto border-t">
      <Container className="py-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-4">
            <BrandLogoBlock width={220} />
            <p className="text-ink-700 max-w-sm text-sm">{BRAND.tagline}</p>
          </div>

          <div className="flex flex-col gap-8 sm:flex-row sm:gap-16">
            <nav aria-label={COPY.nav.courses} className="flex flex-col gap-3">
              <h2 className="text-ink-900 text-sm font-semibold">المنتجات</h2>
              {PRODUCT_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-ink-700 hover:text-brand-700 text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <nav aria-label="روابط قانونية" className="flex flex-col gap-3">
              <h2 className="text-ink-900 text-sm font-semibold">معلومات</h2>
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-ink-700 hover:text-brand-700 text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="border-line-200 mt-10 flex flex-col gap-4 border-t pt-6">
          <p className="text-ink-700 max-w-3xl text-sm leading-relaxed">
            {INDEPENDENCE_DISCLAIMER}
          </p>
          <p className="text-ink-600 text-sm">
            © <bdi dir="ltr">{year}</bdi> {BRAND.name}. جميع الحقوق محفوظة.
          </p>
        </div>
      </Container>
    </footer>
  );
}
