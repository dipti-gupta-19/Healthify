'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { UserProfile, NutritionTargets } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';

const PROFILE_CACHE_KEY = 'healthify-profile';

interface ProfileContextValue {
  profile: UserProfile | null;
  targets: NutritionTargets | null;
  loading: boolean;
  refresh: () => Promise<void>;
  saveProfile: (p: UserProfile) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function readCachedProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) as UserProfile : null;
  } catch {
    return null;
  }
}

function cacheProfile(p: UserProfile | null) {
  if (typeof window === 'undefined') return;
  if (p) sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p));
  else sessionStorage.removeItem(PROFILE_CACHE_KEY);
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [loading, setLoading] = useState(false);

  const applyProfile = useCallback((p: UserProfile | null) => {
    setProfile(p);
    setTargets(p ? calculateTargets(p) : null);
    cacheProfile(p);
  }, []);

  const refresh = useCallback(async () => {
    const hasCache = readCachedProfile();
    if (!hasCache) setLoading(true);
    try {
      const res = await fetch('/api/profile', { headers: { 'x-user-id': 'demo-user' } });
      const data = await res.json();
      if (data.profile) {
        const { _id, _v, userId, updatedAt, ...clean } = data.profile;
        const profile = { ...clean, dietType: clean.dietType || 'non_vegetarian' } as UserProfile;
        applyProfile(profile);
      }
    } catch {
      // keep cached profile if network fails
    } finally {
      setLoading(false);
    }
  }, [applyProfile]);

  const saveProfile = async (p: UserProfile) => {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' },
      body: JSON.stringify(p),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to save profile');
    }
    applyProfile(p);
  };

  useEffect(() => {
    const cached = readCachedProfile();
    if (cached) {
      applyProfile(cached);
    }
    refresh();
  }, [applyProfile, refresh]);

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
