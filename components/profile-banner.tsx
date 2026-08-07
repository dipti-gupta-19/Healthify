'use client';

import Link from 'next/link';
import { useProfile } from '@/components/profile-context';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function ProfileBanner() {
  const { profile } = useProfile();
  if (profile) return null;

  return (
    <div className="mt-6">
      <Link href="/profile">
        <Button size="lg" className="gap-2">
          Set up your profile
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
