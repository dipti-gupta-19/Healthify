import type { Metadata } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';
import { AppProviders } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'Healthify — AI Nutrition Assistant',
  description: 'Identify food, get a personalized health verdict, and track your daily nutrition.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#2d9f6f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
