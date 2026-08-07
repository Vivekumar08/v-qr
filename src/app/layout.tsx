import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { ThemeProvider } from 'next-themes';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

/**
 * Three faces, three jobs.
 *
 * Satoshi carries headings and nothing else — it has enough character to be
 * recognisable and not enough to read comfortably at 14px. Inter runs the
 * interface. Geist Mono is promoted to a first-class face rather than a caption
 * font: GTINs, module millimetres, short codes and check digits are the
 * substance of this product, not decoration around it.
 *
 * Satoshi is self-hosted rather than loaded from Fontshare's CDN — one fewer
 * external request, no flash while it resolves, and it survives a strict CSP.
 */
const satoshi = localFont({
  variable: '--font-satoshi',
  display: 'swap',
  src: [
    { path: './fonts/Satoshi-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Satoshi-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/Satoshi-900.woff2', weight: '900', style: 'normal' },
  ],
});

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'qr-infra console',
  description: 'Product identity codes, destinations and scan analytics.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      // next-themes writes the class here and warns about the mismatch it
      // knowingly creates on first paint.
      suppressHydrationWarning
      className={`${satoshi.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {/* Client boundary. Everything below can use RTK Query hooks; the pages
              themselves stay server components until they need interactivity. */}
          <StoreProvider>
            {children}
            <Toaster richColors closeButton />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
