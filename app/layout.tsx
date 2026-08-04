import type { Metadata } from 'next';
import './globals.css';
import { Inter } from 'next/font/google';
import { ProfileProvider } from '@/components/profile-context';
import { Navbar } from '@/components/navbar';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Healthify — AI Nutrition Assistant',
  description: 'Identify food, get a personalized health verdict, and track your daily nutrition.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <ProfileProvider>
            <Navbar />
            <main className="min-h-[calc(100vh-64px)]">{children}</main>
            <Toaster richColors position="top-center" />
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
