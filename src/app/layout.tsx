import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { StoreProvider } from '@/lib/store/StoreProvider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'qr-infra console',
  description: 'Product identity codes, destinations and scan analytics.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full">
        {/* Client boundary. Everything below can use RTK Query hooks; the pages
            themselves stay server components until they need interactivity. */}
        <StoreProvider>
          {children}
          <Toaster richColors closeButton />
        </StoreProvider>
      </body>
    </html>
  );
}
