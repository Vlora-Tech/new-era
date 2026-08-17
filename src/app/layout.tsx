import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { Toaster } from 'sonner';

import { BRAND, COPY } from '@/lib/copy';

import './globals.css';

/**
 * IBM Plex Sans Arabic is downloaded at build time and served from this origin,
 * so no request leaves the user's browser for a font host at runtime.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
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
    <html lang="ar" dir="rtl" className={plexArabic.variable} suppressHydrationWarning>
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
