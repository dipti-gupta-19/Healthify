'use client';

import { ProfileProvider } from '@/components/profile-context';
import { Navbar } from '@/components/navbar';
import { Toaster } from '@/components/ui/sonner';
import { ChatWidget } from '@/components/chat-widget';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <Navbar />
      <main className="min-h-[calc(100vh-64px)]">{children}</main>
      <Toaster richColors position="top-center" closeButton duration={4500} />
      <ChatWidget />
    </ProfileProvider>
  );
}

