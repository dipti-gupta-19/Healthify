'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { UserProfile, NutritionTargets } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';

interface ProfileContextValue {
  profile: UserProfile | null;
  targets: NutritionTargets | null;
  loading: boolean;
  refresh: () => Promise<void>;
  saveProfile: (p: UserProfile) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch('/api/profile', { headers: { 'x-user-id': 'demo-user' } });
      const data = await res.json();
      if (data.profile) {
        const { _id, _v, userId, updatedAt, ...clean } = data.profile;
        setProfile(clean);
        setTargets(calculateTargets(clean));
      }
    } catch {
      // no profile yet
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (p: UserProfile) => {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' },
      body: JSON.stringify(p),
    });
    setProfile(p);
    setTargets(calculateTargets(p));
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, targets, loading, refresh, saveProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
