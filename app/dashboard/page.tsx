'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrendingUp, AlertTriangle, Flame, Utensils, Calendar as CalendarIcon, Lightbulb, Sparkles } from 'lucide-react';
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
import { DashboardCalendar } from '@/components/dashboard-calendar';
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
      label:
        date === new Date().toDateString()
          ? 'Today'
          : new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      meals: items.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()),
    }));
}

export default function DashboardPage() {
  const { user, profile, targets, loading, token } = useProfile();
  const [meals, setMeals] = useState<LoggedMeal[]>(() => readLocalMeals());
  const [mealsLoading, setMealsLoading] = useState(() => readLocalMeals().length === 0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'timeline' | 'ai-insights'>('timeline');

  const loadMeals = useCallback(async () => {
    const local = readLocalMeals();
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        headers['x-user-id'] = 'demo-user';
      }
      const res = await fetch('/api/meals', { headers });
      const data = await res.json();
      const list = mergeMeals(data.meals || [], local);
      setMeals(list);
      writeLocalMeals(list);
    } catch {
      setMeals(local);
    } finally {
      setMealsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  useEffect(() => {
    const onFocus = () => {
      loadMeals();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [loadMeals]);

  const selectedDateStr = selectedDate.toDateString();
  const isSelectedToday = selectedDateStr === new Date().toDateString();

  const selectedDayMeals = meals.filter((m) => new Date(m.loggedAt).toDateString() === selectedDateStr);
  const consumed = sumFacts(selectedDayMeals);
  const gaps = detectGaps(meals);

  const recommendations =
    targets && profile
      ? [
          ...getDailyRecommendations(consumed, targets, profile),
          ...getLikedMealRecommendations(meals, profile, targets),
        ]
      : [];

  const mealTimeHint = targets && profile ? getMealTimeSuggestion(profile, targets, consumed) : null;

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
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-user-id'] = 'demo-user';
      await fetch(`/api/meals?id=${id}`, { method: 'DELETE', headers });
    } catch {}
    toast.success('Meal removed');
  };

  const timelineGroups = groupMealsByDate(meals);

  if (loading && !profile) {
    return <div className="flex items-center justify-center py-24 text-sm font-semibold text-muted-foreground">Loading health metrics...</div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-8 py-16 text-center">
        <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Set up your profile first</h1>
        <p className="text-sm text-muted-foreground mb-6">Your dashboard needs a health profile to calculate targets and track meals.</p>
        <a href="/profile">
          <Button size="lg" className="text-sm font-bold">Create Profile</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 animate-fade-in">
      <MealTimeNotifier consumedCalories={consumed.calories} />

      {/* TOP HEADER BAR */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Nutrition Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSelectedToday ? 'Showing stats for Today — ' : 'Selected Date: '}
            <span className="font-bold text-primary">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </p>
        </div>

        {user && (
          <Badge variant="outline" className="text-xs font-bold border-primary/40 text-primary px-3 py-1">
            Logged in: {user.name}
          </Badge>
        )}
      </div>

      {/* COMPACT DATE SELECTOR BAR */}
      <DashboardCalendar
        selectedDate={selectedDate}
        onSelectDate={(d) => setSelectedDate(d)}
        meals={meals}
        targetCalories={targets?.calories}
      />

      {/* LIVE BUDGET CARD & SUMMARY */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 p-6 border-2 border-primary/20 shadow-sm glass-card relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Flame className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold">
                Live Budget ({isSelectedToday ? 'Today' : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
              </h2>
            </div>
            <Badge variant={remaining.calories < 0 ? 'destructive' : 'secondary'} className="text-xs font-bold px-2.5 py-1">
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

        <Card className="p-6 border-border shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Date Summary</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Tasks / Meals Logged</span>
              <span className="font-bold text-primary text-base">{selectedDayMeals.length}</span>
            </div>
            <div className="flex justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Calories Consumed</span>
              <span className="font-bold text-foreground text-base">{consumed.calories} kcal</span>
            </div>
            <div className="flex justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Target Calories</span>
              <span className="font-bold text-foreground text-base">{targets?.calories} kcal</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-muted-foreground">Goal</span>
              <span className="font-bold capitalize text-primary text-base">
                {profile.goal === 'loss' ? 'Weight Loss' : profile.goal === 'gain' ? 'Muscle Gain' : 'Maintain'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* TABBED COMPACT VIEW FOR TIMELINE & AI INSIGHTS */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="timeline" className="text-xs sm:text-sm font-bold px-5 py-2 rounded-lg">
              Nutrition Timeline ({meals.length})
            </TabsTrigger>
            <TabsTrigger value="ai-insights" className="text-xs sm:text-sm font-bold px-5 py-2 rounded-lg gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI Insights ({recommendations.length + gaps.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="timeline" className="mt-0">
          {mealsLoading && meals.length === 0 ? (
            <Card className="p-8 text-center text-sm font-semibold text-muted-foreground">Loading logged meals...</Card>
          ) : timelineGroups.length === 0 ? (
            <Card className="p-12 text-center">
              <CalendarIcon className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-base font-bold mb-1">No meals logged yet</p>
              <p className="text-sm text-muted-foreground mb-5">Scan packaged food or snap a photo of your meal to track nutrition.</p>
              <div className="flex justify-center gap-3">
                <a href="/scan/packaged">
                  <Button variant="outline" className="text-sm font-bold">Scan Packaged Food</Button>
                </a>
                <a href="/scan/unpackaged">
                  <Button className="text-sm font-bold">Recognize Meal Photo</Button>
                </a>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {timelineGroups.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground mb-3">
                    <span>{group.label}</span>
                    {group.date === selectedDateStr && (
                      <Badge variant="secondary" className="text-xs bg-primary/20 text-primary py-0.5 font-bold">
                        Selected Date
                      </Badge>
                    )}
                  </div>
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
        </TabsContent>

        <TabsContent value="ai-insights" className="mt-0 space-y-4">
          {mealTimeHint && (
            <Card className="p-5 border-primary/40 bg-primary/10">
              <p className="font-bold text-sm text-primary">{mealTimeHint.message}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{mealTimeHint.suggestion}</p>
            </Card>
          )}

          {recommendations.length > 0 ? (
            <Card className="p-5 border-primary/20 bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-5 w-5 text-emerald-500" />
                <h3 className="text-sm font-bold">Recommended Meals & Tips</h3>
              </div>
              <div className="space-y-2.5 text-sm">
                {recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-secondary/40 font-medium">
                    <span className="text-primary font-bold">•</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-sm font-medium text-muted-foreground">
              No specific meal recommendations for this date.
            </Card>
          )}

          {gaps.length > 0 && (
            <Card className="p-5 border-amber-500/30 bg-amber-500/10">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Pattern Alerts</h3>
              </div>
              <div className="space-y-2 text-sm font-medium">
                {gaps.map((g, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{g}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BudgetStat({
  label,
  consumed,
  target,
  unit,
  remaining,
  warn,
}: {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  remaining: number;
  warn?: boolean;
}) {
  const over = remaining < 0;
  const pctVal = Math.min(100, Math.max(0, (consumed / (target || 1)) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs sm:text-sm mb-1">
        <span className="font-bold">{label}</span>
        <span className={over ? 'text-destructive font-bold' : 'text-muted-foreground font-semibold'}>
          {consumed}/{target}
          {unit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            over ? 'bg-destructive' : warn ? 'bg-amber-500' : 'bg-primary'
          }`}
          style={{ width: `${pctVal}%` }}
        />
      </div>
      <div className={`text-xs mt-1 ${over ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
        {over ? `${Math.abs(remaining)}${unit} over` : `${remaining}${unit} left`}
      </div>
    </div>
  );
}
