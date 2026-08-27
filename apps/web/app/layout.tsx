import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Shoppalyzer GEO — optymalizacja ofert Allegro dla AI',
  description: 'Audyt GEO, zgodność Allegro i bezpieczne generowanie opisów ofert.',
  openGraph: {
    title: 'Shoppalyzer GEO',
    description: 'Optymalizacja ofert Allegro dla wyszukiwania AI',
    type: 'website',
    locale: 'pl_PL',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Shoppalyzer GEO' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shoppalyzer GEO',
    description: 'Optymalizacja ofert Allegro dla wyszukiwania AI',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
