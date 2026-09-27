'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { UserProfile, NutritionTargets } from '@/lib/nutrition';
import { calculateTargets } from '@/lib/nutrition';

const PROFILE_CACHE_KEY = 'healthify-profile';
const TOKEN_CACHE_KEY = 'healthify-token';
const USER_CACHE_KEY = 'healthify-user';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
}

interface ProfileContextValue {
  user: UserSession | null;
  profile: UserProfile | null;
  targets: NutritionTargets | null;
  loading: boolean;
  token: string | null;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  saveProfile: (p: UserProfile) => Promise<void>;
  loginUser: (data: { user: UserSession; profile: UserProfile | null; token: string }) => void;
  logoutUser: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function readCachedProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function cacheProfile(p: UserProfile | null) {
  if (typeof window === 'undefined') return;
  if (p) sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p));
  else sessionStorage.removeItem(PROFILE_CACHE_KEY);
}

function readCachedUser(): UserSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

function readCachedToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_CACHE_KEY);
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const applyProfile = useCallback((p: UserProfile | null) => {
    setProfile(p);
    setTargets(p ? calculateTargets(p) : null);
    cacheProfile(p);
  }, []);

  const loginUser = useCallback(
    (data: { user: UserSession; profile: UserProfile | null; token: string }) => {
      setUser(data.user);
      setToken(data.token);
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
        localStorage.setItem(TOKEN_CACHE_KEY, data.token);
      }
      if (data.profile) {
        const { _id, _v, userId, updatedAt, ...clean } = data.profile as any;
        applyProfile({ ...clean, dietType: clean.dietType || 'vegetarian' } as UserProfile);
      }
    },
    [applyProfile]
  );

  const logoutUser = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setUser(null);
    setToken(null);
    setProfile(null);
    setTargets(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_CACHE_KEY);
      localStorage.removeItem(TOKEN_CACHE_KEY);
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const activeToken = token || readCachedToken();
      if (!activeToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${activeToken}`,
      };

      const res = await fetch('/api/auth/me', { headers });
      const data = await res.json();

      if (data.user) {
        setUser(data.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
        }
      } else {
        setUser(null);
        setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(USER_CACHE_KEY);
          localStorage.removeItem(TOKEN_CACHE_KEY);
        }
      }

      if (data.profile) {
        const { _id, _v, userId, updatedAt, ...clean } = data.profile;
        const prof = { ...clean, dietType: clean.dietType || 'vegetarian' } as UserProfile;
        applyProfile(prof);
      } else if (data.user) {
        const profRes = await fetch('/api/profile', { headers });
        const profData = await profRes.json();
        if (profData.profile) {
          const { _id, _v, userId, updatedAt, ...clean } = profData.profile;
          applyProfile({ ...clean, dietType: clean.dietType || 'vegetarian' } as UserProfile);
        }
      }
    } catch {
      // keep cached profile
    } finally {
      setLoading(false);
    }
  }, [token, applyProfile]);

  const saveProfile = async (p: UserProfile) => {
    const activeToken = token || readCachedToken();
    if (activeToken) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      };

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify(p),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save profile');
      }
    }
    applyProfile(p);
  };

  useEffect(() => {
    const cachedUser = readCachedUser();
    const cachedTok = readCachedToken();
    const cachedProf = readCachedProfile();

    if (cachedUser) setUser(cachedUser);
    if (cachedTok) setToken(cachedTok);
    if (cachedProf) applyProfile(cachedProf);

    refresh();
  }, [applyProfile, refresh]);

  return (
    <ProfileContext.Provider
      value={{
        user,
        profile,
        targets,
        loading,
        token,
        authModalOpen,
        setAuthModalOpen,
        refresh,
        saveProfile,
        loginUser,
        logoutUser,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
