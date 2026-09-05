import type { LoggedMeal } from '@/lib/nutrition';

const HISTORY_KEY = 'healthify-meal-history';
const CACHE_KEY = 'healthify-meals-cache';

export function mealId(meal: Pick<LoggedMeal, '_id'> | { _id?: unknown }): string {
  const raw = meal._id as unknown;
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as { $oid?: string; toString?: () => string };
    if (typeof obj.$oid === 'string') return obj.$oid;
    if (typeof obj.toString === 'function') {
      const s = obj.toString();
      if (s && s !== '[object Object]') return s;
    }
  }
  return String(raw);
}

export function readLocalMeals(): LoggedMeal[] {
  if (typeof window === 'undefined') return [];
  try {
    const fromHistory = window.localStorage.getItem(HISTORY_KEY);
    if (fromHistory) return JSON.parse(fromHistory) as LoggedMeal[];
    const fromCache = window.sessionStorage.getItem(CACHE_KEY);
    return fromCache ? JSON.parse(fromCache) as LoggedMeal[] : [];
  } catch {
    return [];
  }
}

export function writeLocalMeals(meals: LoggedMeal[]) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(meals);
  try {
    window.localStorage.setItem(HISTORY_KEY, payload);
  } catch {
    // ignore quota
  }
  try {
    window.sessionStorage.setItem(CACHE_KEY, payload);
  } catch {
    // ignore quota
  }
}

export function appendLocalMeal(meal: LoggedMeal) {
  const id = mealId(meal) || crypto.randomUUID();
  const next = [{ ...meal, _id: id }, ...readLocalMeals().filter((m) => mealId(m) !== id)];
  writeLocalMeals(next);
  return id;
}

export function removeLocalMeal(id: string) {
  writeLocalMeals(readLocalMeals().filter((m) => mealId(m) !== id));
}

export function mergeMeals(server: LoggedMeal[], local: LoggedMeal[]): LoggedMeal[] {
  const byId = new Map<string, LoggedMeal>();
  for (const m of [...local, ...server]) {
    const id = mealId(m);
    if (!id) continue;
    byId.set(id, { ...m, _id: id });
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
  );
}
