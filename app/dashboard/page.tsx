'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  AlertTriangle,
  Flame,
  Utensils,
  Calendar as CalendarIcon,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  Lock,
  HeartPulse,
  Activity,
  History,
  PieChart,
  Search,
} from 'lucide-react';
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
import { HealthCheckinBanner } from '@/components/health-checkin-banner';
import { MonthlyNutritionTimeline } from '@/components/monthly-nutrition-timeline';
import { toast } from 'sonner';
import { mealId, mergeMeals, readLocalMeals, removeLocalMeal, writeLocalMeals } from '@/lib/meal-history';
import { getStoredHealthCheckin, getHealthAdvice, HealthCondition } from '@/lib/health-checkin';

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
  const { user, profile, targets, loading, token, setAuthModalOpen } = useProfile();
  const [meals, setMeals] = useState<LoggedMeal[]>(() => readLocalMeals());
  const [mealsLoading, setMealsLoading] = useState(() => readLocalMeals().length === 0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'ai-overview' | 'monthly' | 'history'>('ai-overview');
  const [healthCond, setHealthCond] = useState<HealthCondition>('healthy');

  const [searchQuery, setSearchQuery] = useState('');

  const selectedDateStr = selectedDate.toDateString();
  const dateIsoKey = selectedDate.toISOString().split('T')[0];

  useEffect(() => {
    const checkin = getStoredHealthCheckin(dateIsoKey);
    setHealthCond(checkin.condition);
  }, [dateIsoKey]);

  const loadMeals = useCallback(async () => {
    const local = readLocalMeals();
    if (!token) {
      setMeals(local);
      setMealsLoading(false);
      return;
    }
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
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

  const isSelectedToday = selectedDateStr === new Date().toDateString();
  const selectedDayMeals = meals.filter((m) => new Date(m.loggedAt).toDateString() === selectedDateStr);
  const consumed = sumFacts(selectedDayMeals);
  const gaps = detectGaps(meals);

  const healthAdvice = getHealthAdvice(healthCond);

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
    if (token) {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        await fetch(`/api/meals?id=${id}`, { method: 'DELETE', headers });
      } catch {}
    }
    toast.success('Meal removed');
  };

  // Search filter by food name, date, meal type, or symptoms
  const filteredMeals = meals.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = m.foodName.toLowerCase().includes(q);
    const dateMatch = new Date(m.loggedAt)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short', year: 'numeric' })
      .toLowerCase()
      .includes(q);
    const typeMatch = m.mealType.toLowerCase().includes(q);
    const reasonMatch = m.healthValidation?.reason?.toLowerCase().includes(q) || false;
    return nameMatch || dateMatch || typeMatch || reasonMatch;
  });

  const timelineGroups = groupMealsByDate(filteredMeals);

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center py-24 text-sm font-semibold text-muted-foreground">
        Loading health metrics...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-8 py-16 text-center">
        <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Set up your profile first</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Your dashboard needs a health profile to calculate targets and track meals.
        </p>
        <a href="/profile">
          <Button size="lg" className="text-sm font-bold">
            Create Profile
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 animate-fade-in space-y-6">
      <MealTimeNotifier consumedCalories={consumed.calories} />

      {/* TOP HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <span>Nutrition & AI Health Dashboard</span>
            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSelectedToday ? 'Showing stats for Today — ' : 'Selected Date: '}
            <span className="font-bold text-primary">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <Badge variant="outline" className="text-xs font-bold border-primary/40 text-primary px-3 py-1">
              Logged in: {user.name} (Database Synced)
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAuthModalOpen(true)}
              className="gap-1.5 text-xs font-bold border-amber-500/40 text-amber-600 dark:text-amber-400"
            >
              <Lock className="h-3.5 w-3.5" /> Sign in to sync MongoDB
            </Button>
          )}
        </div>
      </div>

      {/* COMPACT DATE SELECTOR CALENDAR BAR */}
      <DashboardCalendar
        selectedDate={selectedDate}
        onSelectDate={(d) => setSelectedDate(d)}
        meals={meals}
        targetCalories={targets?.calories}
      />

      {/* MAIN TABBED NAVIGATION - FIRST TAB IS LIVE BUDGET & AI INSIGHTS */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="ai-overview" className="text-xs sm:text-sm font-bold px-4 py-2 rounded-lg gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Live Budget & AI Insights
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs sm:text-sm font-bold px-4 py-2 rounded-lg gap-2">
              <PieChart className="h-4 w-4 text-emerald-500" /> Monthly Timeline & Fitness
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm font-bold px-4 py-2 rounded-lg gap-2">
              <History className="h-4 w-4 text-sky-500" /> Food History Log ({selectedDayMeals.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: AI OVERVIEW & LIVE BUDGET (SHOWN ON FIRST PAGE) */}
        <TabsContent value="ai-overview" className="mt-0 space-y-6">
          {/* LIVE BUDGET CARD & SUMMARY */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 border-2 border-primary/20 shadow-md glass-card relative overflow-hidden">
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

            <Card className="p-6 border-border shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-bold">Daily Macro Progress</h2>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Meals Logged Today</span>
                    <span className="font-bold text-primary text-base">{selectedDayMeals.length}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Calories Consumed</span>
                    <span className="font-bold text-foreground text-base">{consumed.calories} / {targets?.calories} kcal</span>
                  </div>
                  <div className="flex justify-between border-b border-border/60 pb-2">
                    <span className="text-muted-foreground">Protein Target</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">{consumed.protein} / {targets?.protein} g</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Goal Strategy</span>
                    <span className="font-bold capitalize text-primary text-base">
                      {profile.goal === 'loss' ? 'Weight Loss (-500 kcal)' : profile.goal === 'gain' ? 'Muscle Gain (+400 kcal)' : 'Maintain'}
                    </span>
                  </div>
                </div>
              </div>

              {healthCond !== 'healthy' && (
                <div className="mt-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-900 dark:text-rose-200 font-semibold">
                  🩺 Health Condition Active: {healthAdvice.title}. Dietary targets adjusted for recovery.
                </div>
              )}
            </Card>
          </div>

          {/* AI INSIGHTS & HEALTH RECOMMENDATIONS SECTION */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* TAILORED AI HEALTH & DIET VERDICT */}
            <Card className="p-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-card shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-base font-extrabold text-foreground">AI Today Verdict & Health Guidance</h3>
              </div>

              {healthCond !== 'healthy' ? (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 text-sm">
                    <span>🤒 Special Recovery Verdict ({healthAdvice.title})</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {healthAdvice.description}
                  </p>
                  <div className="pt-2 border-t border-amber-500/20 text-xs space-y-1">
                    <span className="font-bold text-foreground">Recommended Meals for Today:</span>
                    {healthAdvice.recommendedFoods.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 font-semibold text-primary">
                        <span>{item.emoji}</span>
                        <span>{item.name} ({item.desc})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Fit & Optimal Health Status</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You are in great shape today. Keep hitting your protein target of {targets?.protein}g while keeping saturated fat and added sugars in check.
                  </p>
                </div>
              )}

              {/* MEAL TIMING ADVICE */}
              {mealTimeHint && (
                <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1">
                  <p className="font-bold text-xs sm:text-sm text-primary">{mealTimeHint.message}</p>
                  <p className="text-xs text-muted-foreground">{mealTimeHint.suggestion}</p>
                </div>
              )}

              {/* RECOMMENDED MEALS LIST */}
              {recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Recommended Foods & Smart Substitutions</h4>
                  <div className="space-y-2 text-xs">
                    {recommendations.slice(0, 4).map((r, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-card border border-border/60">
                        <Lightbulb className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="font-semibold text-foreground">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* PATTERN ALERTS & GAPS */}
            <Card className="p-6 border border-border shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-foreground">Nutritional Gaps & Pattern Alerts</h3>
              </div>

              {gaps.length > 0 ? (
                <div className="space-y-2.5">
                  {gaps.map((g, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs font-medium text-amber-900 dark:text-amber-200">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="font-bold text-sm text-foreground">No critical nutrition gaps detected!</p>
                  <p>Your meal logging patterns show balanced macronutrient distribution.</p>
                </div>
              )}

            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: MONTHLY NUTRITION TIMELINE & FITNESS VALIDATION */}
        <TabsContent value="monthly" className="mt-0">
          <MonthlyNutritionTimeline meals={meals} targets={targets} />
        </TabsContent>

        {/* TAB 3: COMPACT FOOD HISTORY LOG */}
        <TabsContent value="history" className="mt-0 space-y-4">
          {/* FOOD & DATE SEARCH BAR */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food history by dish name (e.g. Biryani, Bourbon), date (e.g. Sep 22), or meal type..."
              className="pl-10 text-xs sm:text-sm h-10 bg-card border-border/80"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground font-bold px-2 py-0.5 rounded-md hover:bg-muted"
              >
                Clear
              </button>
            )}
          </div>

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
                <div key={group.date} className="space-y-3">
                  <div className="flex items-center justify-between text-sm font-bold text-muted-foreground border-b border-border/50 pb-2">
                    <span className="text-foreground text-base">{group.label}</span>
                    <Badge variant="outline" className="text-xs font-bold">
                      {group.meals.length} {group.meals.length === 1 ? 'meal' : 'meals'} ({sumFacts(group.meals).calories} kcal)
                    </Badge>
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
