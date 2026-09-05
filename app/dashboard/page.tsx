'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle, Flame, Utensils, Calendar, Lightbulb } from 'lucide-react';
import type { LoggedMeal, NutritionFacts } from '@/lib/nutrition';
import {
  sumFacts,
  detectGaps,
  getDailyRecommendations,
  getLikedMealRecommendations,
  getMealTimeSuggestion,
} from '@/lib/nutrition';
import { MealTimelineCard } from '@/components/meal-timeline-card';
import { MealTimeNotifier } from '@/components/meal-time-notifier';
import { toast } from 'sonner';
import { mealId, mergeMeals, readLocalMeals, removeLocalMeal, writeLocalMeals } from '@/lib/meal-history';

function groupMealsByDate(meals: LoggedMeal[]): { date: string; label: string; meals: LoggedMeal[] }[] {
  const groups: Record<string, LoggedMeal[]> = {};
  for (const m of meals) {
    const d = new Date(m.loggedAt).toDateString();
    if (!groups[d]) groups[d] = [];
    groups[d].push(m);
  }
  return Object.entries(groups)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .map(([date, items]) => ({
      date,
      label: date === new Date().toDateString()
        ? 'Today'
        : new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      meals: items.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()),
    }));
}

export default function DashboardPage() {
  const { profile, targets, loading } = useProfile();
  const [meals, setMeals] = useState<LoggedMeal[]>(() => readLocalMeals());
  const [mealsLoading, setMealsLoading] = useState(() => readLocalMeals().length === 0);

  const loadMeals = useCallback(async () => {
    const local = readLocalMeals();
    try {
      const res = await fetch('/api/meals', { headers: { 'x-user-id': 'demo-user' } });
      const data = await res.json();
      const list = mergeMeals(data.meals || [], local);
      setMeals(list);
      writeLocalMeals(list);
    } catch {
      setMeals(local);
    } finally {
      setMealsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  useEffect(() => {
    const onFocus = () => { loadMeals(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [loadMeals]);

  const todayStr = new Date().toDateString();
  const todayMeals = meals.filter((m) => new Date(m.loggedAt).toDateString() === todayStr);
  const consumed = sumFacts(todayMeals);
  const gaps = detectGaps(meals);

  const recommendations = targets && profile
    ? [
      ...getDailyRecommendations(consumed, targets, profile),
      ...getLikedMealRecommendations(meals, profile, targets),
    ]
    : [];

  const mealTimeHint = targets && profile
    ? getMealTimeSuggestion(profile, targets, consumed)
    : null;

  const remaining: NutritionFacts = {
    calories: (targets?.calories || 0) - consumed.calories,
    protein: (targets?.protein || 0) - consumed.protein,
    carbs: (targets?.carbs || 0) - consumed.carbs,
    fat: (targets?.fat || 0) - consumed.fat,
    fiber: (targets?.fiber || 0) - consumed.fiber,
    sugar: (targets?.sugarMax || 0) - consumed.sugar,
    sodium: (targets?.sodiumMax || 0) - consumed.sodium,
  };

  const deleteMeal = async (id: string) => {
    removeLocalMeal(id);
    setMeals((prev) => prev.filter((m) => mealId(m) !== id));
    try {
      await fetch(`/api/meals?id=${id}`, { method: 'DELETE', headers: { 'x-user-id': 'demo-user' } });
    } catch {
      // local history already updated
    }
    toast.success('Meal removed');
  };

  const timelineGroups = groupMealsByDate(meals);

  if (loading && !profile) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Set up your profile first</h1>
        <p className="text-muted-foreground mb-6">Your dashboard needs a health profile to calculate targets and track meals.</p>
        <a href="/profile"><Button>Create Profile</Button></a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <MealTimeNotifier consumedCalories={consumed.calories} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Today&apos;s Dashboard</h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {mealTimeHint && (
        <Card className="p-4 mb-6 border-primary/40 bg-primary/10">
          <p className="font-semibold text-primary">{mealTimeHint.message}</p>
          <p className="text-sm text-muted-foreground mt-1">{mealTimeHint.suggestion}</p>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Live Budget</h2>
            </div>
            <Badge variant={remaining.calories < 0 ? 'destructive' : 'secondary'}>
              {remaining.calories < 0 ? 'Over budget' : `${remaining.calories} kcal left`}
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <BudgetStat label="Calories" consumed={consumed.calories} target={targets?.calories || 0} unit="kcal" remaining={remaining.calories} />
            <BudgetStat label="Protein" consumed={consumed.protein} target={targets?.protein || 0} unit="g" remaining={remaining.protein} />
            <BudgetStat label="Carbs" consumed={consumed.carbs} target={targets?.carbs || 0} unit="g" remaining={remaining.carbs} />
            <BudgetStat label="Fat" consumed={consumed.fat} target={targets?.fat || 0} unit="g" remaining={remaining.fat} />
            <BudgetStat label="Fiber" consumed={consumed.fiber} target={targets?.fiber || 0} unit="g" remaining={remaining.fiber} />
            <BudgetStat label="Sugar" consumed={consumed.sugar} target={targets?.sugarMax || 0} unit="g" remaining={remaining.sugar} warn />
            <BudgetStat label="Sodium" consumed={consumed.sodium} target={targets?.sodiumMax || 0} unit="mg" remaining={remaining.sodium} warn />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Summary</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Meals today</span><span className="font-semibold">{todayMeals.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Calories</span><span className="font-semibold">{consumed.calories} kcal</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Daily target</span><span className="font-semibold">{targets?.calories} kcal</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Goal</span><span className="font-semibold capitalize">{profile.goal === 'loss' ? 'Weight Loss' : profile.goal === 'gain' ? 'Muscle Gain' : 'Maintain'}</span></div>
          </div>
        </Card>
      </div>

      {recommendations.length > 0 && (
        <Card className="p-5 mb-6 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">What to eat next</h2>
          </div>
          <div className="space-y-2 text-sm">
            {recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {gaps.length > 0 && (
        <Card className="p-5 mb-6 border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-warning">Pattern Alerts</h2>
          </div>
          <div className="space-y-2 text-sm">
            {gaps.map((g, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-warning">•</span>
                <span>{g}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Nutrition Timeline</h2>
          <p className="text-xs text-muted-foreground">Your meal history — every food you log shows up here</p>
        </div>
        <span className="text-xs text-muted-foreground">{meals.length} logged</span>
      </div>

      {mealsLoading && meals.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Loading meals...</Card>
      ) : timelineGroups.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No meals logged yet.</p>
          <div className="flex justify-center gap-3">
            <a href="/scan/packaged"><Button variant="outline">Scan Packaged Food</Button></a>
            <a href="/scan/unpackaged"><Button>Scan Unpackaged Food</Button></a>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {timelineGroups.map((group) => (
            <div key={group.date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group.label}</h3>
              <div className="space-y-3">
                {group.meals.map((meal) => (
                  <MealTimelineCard
                    key={mealId(meal) || `${meal.foodName}-${meal.loggedAt}`}
                    meal={meal}
                    onDelete={deleteMeal}
                    onFeedbackSubmitted={loadMeals}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetStat({
  label, consumed, target, unit, remaining, warn,
}: {
  label: string; consumed: number; target: number; unit: string; remaining: number; warn?: boolean;
}) {
  const over = remaining < 0;
  const pctVal = Math.min(100, Math.max(0, (consumed / (target || 1)) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className={over ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
          {consumed}/{target}{unit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${over ? 'bg-destructive' : warn ? 'bg-warning' : 'bg-primary'}`}
          style={{ width: `${pctVal}%` }}
        />
      </div>
      <div className={`text-xs mt-1 ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
        {over ? `${Math.abs(remaining)}${unit} over` : `${remaining}${unit} left`}
      </div>
    </div>
  );
}
