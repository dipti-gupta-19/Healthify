'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/components/profile-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, AlertTriangle, Flame, Trash2, Utensils, Calendar } from 'lucide-react';
import type { LoggedMeal, NutritionFacts, NutritionTargets } from '@/lib/nutrition';
import { sumFacts, detectGaps, emptyFacts } from '@/lib/nutrition';
import { toast } from 'sonner';

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

export default function DashboardPage() {
  const { profile, targets, loading } = useProfile();
  const [meals, setMeals] = useState<LoggedMeal[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/meals', { headers: { 'x-user-id': 'demo-user' } });
        const data = await res.json();
        setMeals(data.meals || []);
      } catch {
        // ignore
      }
    })();
  }, [refreshKey]);

  const todayStr = new Date().toDateString();
  const todayMeals = meals
    .filter((m) => new Date(m.loggedAt).toDateString() === todayStr)
    .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  const consumed = sumFacts(todayMeals);
  const gaps = detectGaps(meals);

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
    await fetch(`/api/meals?id=${id}`, { method: 'DELETE', headers: { 'x-user-id': 'demo-user' } });
    setRefreshKey((k) => k + 1);
    toast.success('Meal removed');
  };

  const pct = (val: number, target: number) => Math.min(100, Math.max(0, (val / (target || 1)) * 100));

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
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
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold mb-1">Today's Dashboard</h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 p-6 animate-slide-up">
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

        <Card className="p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Summary</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Meals logged</span><span className="font-semibold">{todayMeals.length}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Calories consumed</span><span className="font-semibold">{consumed.calories} kcal</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Protein consumed</span><span className="font-semibold">{consumed.protein} g</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Daily target</span><span className="font-semibold">{targets?.calories} kcal</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Goal</span><span className="font-semibold capitalize">{profile.goal === 'loss' ? 'Weight Loss' : profile.goal === 'gain' ? 'Muscle Gain' : 'Maintain'}</span></div>
          </div>
        </Card>
      </div>

      {gaps.length > 0 && (
        <Card className="p-5 mb-6 border-warning/30 bg-warning/5 animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-warning">Pattern Alerts</h2>
          </div>
          <div className="space-y-2">
            {gaps.map((g, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-warning mt-0.5">•</span>
                <span>{g}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Nutrition Timeline</h2>
      </div>

      {todayMeals.length === 0 ? (
        <Card className="p-12 text-center animate-fade-in">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No meals logged yet today.</p>
          <div className="flex justify-center gap-3">
            <a href="/scan/packaged"><Button variant="outline">Scan Packaged Food</Button></a>
            <a href="/scan/unpackaged"><Button>Scan Unpackaged Food</Button></a>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {todayMeals.map((meal) => (
            <Card key={meal._id as string} className="p-4 flex items-center gap-4 animate-slide-up">
              <span className="text-3xl">{meal.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold capitalize truncate">{meal.foodName}</h3>
                  <Badge variant="outline" className="capitalize">{MEAL_ICONS[meal.mealType]} {meal.mealType}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(meal.loggedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {' · '}
                  {meal.facts.calories} kcal · {meal.facts.protein}g protein · {meal.facts.carbs}g carbs · {meal.facts.fat}g fat
                </div>
                {meal.warnings.length > 0 && (
                  <div className="text-xs text-destructive mt-1">{meal.warnings.join(' · ')}</div>
                )}
              </div>
              <button
                onClick={() => deleteMeal(meal._id as string)}
                className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex-shrink-0"
                aria-label="Delete meal"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
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
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className={over ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
          {consumed}/{target}{unit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-destructive' : warn ? 'bg-warning' : 'bg-primary'}`}
          style={{ width: `${pctVal}%` }}
        />
      </div>
      <div className={`text-xs mt-1 ${over ? 'text-destructive' : 'text-muted-foreground'}`}>
        {over ? `${Math.abs(remaining)}${unit} over` : `${remaining}${unit} left`}
      </div>
    </div>
  );
}
