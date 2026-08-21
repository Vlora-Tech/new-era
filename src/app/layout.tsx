import type { Metadata, Viewport } from 'next';
import { Alexandria, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { Toaster } from 'sonner';

import { BRAND, COPY } from '@/lib/copy';

import './globals.css';

/**
 * The identity's two families, both downloaded at build time and served from
 * this origin, so no request leaves the user's browser for a font host at
 * runtime. IBM Plex Sans Arabic carries body and UI text; Alexandria carries
 * headings and display numerals (`--font-display` in globals.css). See
 * docs/design-system.md.
 *
 * Both carry 300, and it is not optional: `text-lead` and `text-lead-lg` are
 * weight 300 — the canvas's weight for the paragraph under a headline — and a
 * missing 300 does not fall back gracefully. The browser synthesises it from
 * 400 by thinning the outline, which on Arabic breaks the joins the way faux
 * bold does. Alexandria also carries 800 for the display numerals the canvas
 * sets above the section heads.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

const alexandria = Alexandria({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-alexandria',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: COPY.home.supporting,
  applicationName: BRAND.name,
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: COPY.home.supporting,
  },
  robots: { index: true, follow: true },

  /**
   * The brand marks, declared through `metadata` rather than hand-written
   * `<link>` tags so Next owns the `<head>` and the paths are typechecked.
   *
   * `/favicon.ico` is deliberately absent from this list. `src/app/favicon.ico`
   * is a Next file convention: it is served at that URL and linked
   * automatically, so naming it here again would emit a second, competing
   * `<link rel="icon">` for the same file. The remaining assets live under
   * `public/favicon/`, hence the prefix — the generator's snippet assumes the
   * public root, and copying it verbatim would 404 every one of them.
   *
   * `favicon.svg` is deliberately NOT linked, even though the generator's
   * snippet offers it and the file is present. It is not a vector: it is a
   * 1397×1126 raster base64'd inside an `<svg>` wrapper, which makes it 722 KB
   * — about a hundred and twenty times the 96px PNG for exactly the same
   * picture, and no more scalable. A browser that prefers SVG would download
   * all of it to draw a 16px tab icon. It becomes worth linking the day a true
   * vector master exists, which `docs/brand-assets-needed.md` already lists as
   * outstanding.
   *
   * The 192px entry is not a duplicate of the manifest's: this one is a browser
   * tab icon for high-density displays, the manifest's is an installed-app
   * icon, and the two are read by different consumers.
   */
  icons: {
    icon: [
      { url: '/favicon/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
      { url: '/favicon/web-app-manifest-192x192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/favicon/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/favicon/site.webmanifest',
};

export const viewport: Viewport = {
  // The product ships one theme. Declaring it stops the browser from applying
  // its own dark treatment to form controls and scrollbars.
  colorScheme: 'light',
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${alexandria.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          dir="rtl"
          theme="light"
          richColors
          closeButton
          toastOptions={{ classNames: { toast: 'font-sans' } }}
        />
      </body>
    </html>
  );
}
