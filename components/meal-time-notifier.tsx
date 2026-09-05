'use client';

import { useEffect } from 'react';
import { useProfile } from '@/components/profile-context';
import { getMealTimeSuggestion } from '@/lib/nutrition';
import { toast } from 'sonner';

const NOTIFIER_KEY = 'healthify-meal-notify';

function getNotifiedToday(): Set<string> {
  try {
    const raw = sessionStorage.getItem(NOTIFIER_KEY);
    if (!raw) return new Set();
    const { date, types } = JSON.parse(raw) as { date: string; types: string[] };
    if (date !== new Date().toDateString()) return new Set();
    return new Set(types);
  } catch {
    return new Set();
  }
}

function markNotified(mealType: string) {
  const today = new Date().toDateString();
  const notified = getNotifiedToday();
  notified.add(mealType);
  sessionStorage.setItem(NOTIFIER_KEY, JSON.stringify({ date: today, types: [...notified] }));
}

export function MealTimeNotifier({ consumedCalories }: { consumedCalories: number }) {
  const { profile, targets } = useProfile();

  useEffect(() => {
    if (!profile || !targets) return;

    const consumed = { calories: consumedCalories, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
    const suggestion = getMealTimeSuggestion(profile, targets, consumed);
    if (!suggestion) return;

    const notified = getNotifiedToday();
    if (notified.has(suggestion.mealType)) return;

    const timer = setTimeout(() => {
      toast(suggestion.message, {
        description: suggestion.suggestion,
        duration: 8000,
        closeButton: true,
        action: {
          label: 'Scan food',
          onClick: () => { window.location.href = '/scan/unpackaged'; },
        },
      });
      markNotified(suggestion.mealType);
    }, 1500);

    return () => clearTimeout(timer);
  }, [profile, targets, consumedCalories]);

  return null;
}
