import type { LoggedMeal, NutritionTargets, UserProfile } from './nutrition';
import { sumFacts } from './nutrition';
import { getStoredHealthCheckin, getHealthAdvice } from './health-checkin';

export interface AINotification {
  id: string;
  type: 'recommendation' | 'reminder' | 'pattern' | 'health_alert';
  title: string;
  message: string;
  timestamp: string;
  read?: boolean;
}

const NOTIFICATION_STORAGE_KEY = 'healthify_read_notifications';

export function getReadNotificationIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markNotificationAsRead(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const read = getReadNotificationIds();
    if (!read.includes(id)) {
      read.push(id);
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(read));
    }
  } catch {}
}

export function generateLiveNotifications(
  meals: LoggedMeal[],
  targets: NutritionTargets | null,
  profile: UserProfile | null
): AINotification[] {
  const notifications: AINotification[] = [];
  const readIds = getReadNotificationIds();
  const todayStr = new Date().toDateString();
  const dateKey = new Date().toISOString().split('T')[0];

  const todayMeals = meals.filter((m) => new Date(m.loggedAt).toDateString() === todayStr);
  const consumed = sumFacts(todayMeals);

  // 1. Health Status Notification
  const healthCheckin = getStoredHealthCheckin(dateKey);
  if (healthCheckin.condition !== 'healthy') {
    const advice = getHealthAdvice(healthCheckin.condition);
    const id = `health-${dateKey}-${healthCheckin.condition}`;
    notifications.push({
      id,
      type: 'health_alert',
      title: `Daily Health Alert: ${advice.title}`,
      message: `Because you reported ${advice.title} today, AI suggests light foods like ${advice.recommendedFoods[0]?.name || 'soothing broth'} and plenty of fluids.`,
      timestamp: 'Today',
      read: readIds.includes(id),
    });
  }

  // 2. Protein Target Progress Notification
  if (targets) {
    const protPct = Math.round((consumed.protein / targets.protein) * 100);
    const id = `prot-${dateKey}-${Math.floor(protPct / 25)}`;
    if (protPct >= 100) {
      notifications.push({
        id: `prot-100-${dateKey}`,
        type: 'recommendation',
        title: '🎉 Daily Protein Goal Achieved!',
        message: `Great job! You've met 100% of your daily protein target (${consumed.protein}g / ${targets.protein}g).`,
        timestamp: 'Just now',
        read: readIds.includes(`prot-100-${dateKey}`),
      });
    } else if (protPct < 40 && todayMeals.length >= 2) {
      notifications.push({
        id,
        type: 'recommendation',
        title: 'Protein Intake Boost Required',
        message: `You are at ${protPct}% of your protein target today (${consumed.protein}g / ${targets.protein}g). Consider high-protein meals like paneer, Greek yogurt, or lentils.`,
        timestamp: 'Today',
        read: readIds.includes(id),
      });
    }
  }

  // 3. High Sugar Warning Notification
  if (targets && consumed.sugar > targets.sugarMax) {
    const id = `sugar-exceeded-${dateKey}`;
    notifications.push({
      id,
      type: 'pattern',
      title: '⚠️ Sugar Threshold Exceeded',
      message: `You consumed ${consumed.sugar}g sugar today (limit is ${targets.sugarMax}g). Consider swapping evening snacks for fruits or nuts.`,
      timestamp: 'Today',
      read: readIds.includes(id),
    });
  }

  // 4. Meal Reminder Notification
  const currentHour = new Date().getHours();
  if (todayMeals.length === 0 && currentHour >= 13) {
    const id = `no-meals-lunch-${dateKey}`;
    notifications.push({
      id,
      type: 'reminder',
      title: 'Log Your Meals Today',
      message: 'You haven\'t logged any meals today yet! Snap a photo or scan packaged food to keep your live budget updated.',
      timestamp: 'Reminder',
      read: readIds.includes(id),
    });
  }

  // 5. Default welcoming recommendation if empty
  if (notifications.length === 0) {
    notifications.push({
      id: 'welcome-init',
      type: 'recommendation',
      title: 'AI Nutrition Assistant Active',
      message: 'Log your meals daily to receive dynamic macro insights, health alerts, and personalized verdict tips.',
      timestamp: 'Active',
      read: readIds.includes('welcome-init'),
    });
  }

  return notifications;
}
