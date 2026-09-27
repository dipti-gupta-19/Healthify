'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertCircle,
  Flame,
  Activity,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { LoggedMeal, NutritionTargets } from '@/lib/nutrition';
import { sumFacts } from '@/lib/nutrition';

interface MonthlyNutritionTimelineProps {
  meals: LoggedMeal[];
  targets: NutritionTargets | null;
}

interface MonthStats {
  monthKey: string; // e.g. "2026-09"
  monthName: string; // e.g. "September 2026"
  totalMeals: number;
  daysLoggedCount: number;
  avgCaloriesPerDay: number;
  avgProteinPerDay: number;
  avgCarbsPerDay: number;
  avgFatPerDay: number;
  avgFiberPerDay: number;
  avgSugarPerDay: number;
  consistencyScore: number; // % of target met
  fitnessVerdict: {
    status: 'excellent' | 'good' | 'needs_improvement';
    badge: string;
    message: string;
  };
}

export function MonthlyNutritionTimeline({ meals = [], targets }: MonthlyNutritionTimelineProps) {
  // Group meals by month
  const monthlyData = useMemo(() => {
    const map: Record<string, LoggedMeal[]> = {};

    for (const m of meals) {
      const d = new Date(m.loggedAt);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }

    const targetCal = targets?.calories || 2000;
    const targetProt = targets?.protein || 120;

    const result: MonthStats[] = Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, monthMeals]) => {
        const [yearStr, monthStr] = monthKey.split('-');
        const dateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
        const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Group by days
        const dayMap: Record<string, LoggedMeal[]> = {};
        for (const m of monthMeals) {
          const dayKey = new Date(m.loggedAt).toDateString();
          if (!dayMap[dayKey]) dayMap[dayKey] = [];
          dayMap[dayKey].push(m);
        }

        const daysLoggedCount = Object.keys(dayMap).length || 1;
        const totalConsumed = sumFacts(monthMeals);

        const avgCaloriesPerDay = Math.round(totalConsumed.calories / daysLoggedCount);
        const avgProteinPerDay = Math.round(totalConsumed.protein / daysLoggedCount);
        const avgCarbsPerDay = Math.round(totalConsumed.carbs / daysLoggedCount);
        const avgFatPerDay = Math.round(totalConsumed.fat / daysLoggedCount);
        const avgFiberPerDay = Math.round(totalConsumed.fiber / daysLoggedCount);
        const avgSugarPerDay = Math.round(totalConsumed.sugar / daysLoggedCount);

        // Calculate consistency score
        const calDiffRatio = Math.abs(avgCaloriesPerDay - targetCal) / targetCal;
        const consistencyScore = Math.max(20, Math.min(100, Math.round((1 - calDiffRatio * 0.7) * 100)));

        let status: 'excellent' | 'good' | 'needs_improvement' = 'good';
        let badge = 'Balanced Track';
        let message = 'Your overall caloric and protein distribution aligns well with your monthly target goals.';

        if (consistencyScore >= 85) {
          status = 'excellent';
          badge = 'High Fitness Adherence';
          message = `Great consistency! You maintained an average of ${avgCaloriesPerDay} kcal/day close to your target of ${targetCal} kcal.`;
        } else if (avgCaloriesPerDay > targetCal + 350) {
          status = 'needs_improvement';
          badge = 'Caloric Surplus Warning';
          message = `Monthly average of ${avgCaloriesPerDay} kcal is higher than target (${targetCal} kcal). Try adjusting portion sizes.`;
        } else if (avgProteinPerDay < targetProt * 0.75) {
          status = 'needs_improvement';
          badge = 'Protein Deficit Alert';
          message = `Average protein (${avgProteinPerDay}g/day) is below your target (${targetProt}g/day). Add more protein sources.`;
        }

        return {
          monthKey,
          monthName,
          totalMeals: monthMeals.length,
          daysLoggedCount,
          avgCaloriesPerDay,
          avgProteinPerDay,
          avgCarbsPerDay,
          avgFatPerDay,
          avgFiberPerDay,
          avgSugarPerDay,
          consistencyScore,
          fitnessVerdict: { status, badge, message },
        };
      });

    return result;
  }, [meals, targets]);

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);

  if (monthlyData.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed border-border/80">
        <Calendar className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
        <h3 className="text-base font-bold mb-1">No Monthly Data Yet</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          As you log meals over days and weeks, your monthly nutrition timeline and fitness consistency ratings will automatically populate here.
        </p>
      </Card>
    );
  }

  const current = monthlyData[selectedMonthIndex] || monthlyData[0];
  const targetCal = targets?.calories || 2000;
  const targetProt = targets?.protein || 120;

  return (
    <div className="space-y-6">
      {/* MONTH NAVIGATION HEADER */}
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-foreground">{current.monthName}</h3>
            <p className="text-xs text-muted-foreground">
              {current.daysLoggedCount} days logged • {current.totalMeals} total meals
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedMonthIndex((prev) => Math.min(monthlyData.length - 1, prev + 1))}
            disabled={selectedMonthIndex >= monthlyData.length - 1}
            className="h-9 w-9 rounded-xl"
            aria-label="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-bold px-2">
            {selectedMonthIndex + 1} of {monthlyData.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedMonthIndex((prev) => Math.max(0, prev - 1))}
            disabled={selectedMonthIndex === 0}
            className="h-9 w-9 rounded-xl"
            aria-label="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* FITNESS VALIDATION & CONSISTENCY CARD */}
      <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-background to-secondary/30 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 border-primary/40 text-primary font-bold text-xs px-2.5 py-0.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Monthly Fitness Verdict
              </Badge>
              <Badge
                variant={
                  current.fitnessVerdict.status === 'excellent'
                    ? 'default'
                    : current.fitnessVerdict.status === 'good'
                    ? 'secondary'
                    : 'destructive'
                }
                className="text-xs font-bold px-2.5 py-0.5"
              >
                {current.fitnessVerdict.badge}
              </Badge>
            </div>
            <h4 className="text-xl font-bold text-foreground">Consistency Score: {current.consistencyScore}%</h4>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">{current.fitnessVerdict.message}</p>
          </div>

          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-card border border-border shadow-xs shrink-0 min-w-[130px]">
            <Award className="h-8 w-8 text-primary mb-1" />
            <span className="text-2xl font-extrabold text-foreground">{current.consistencyScore}%</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Goal Alignment</span>
          </div>
        </div>

        {/* MONTHLY AVERAGE NUTRITION STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex justify-between text-xs text-muted-foreground font-semibold mb-1">
              <span>Avg Calories</span>
              <Flame className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-xl font-extrabold text-foreground">{current.avgCaloriesPerDay} <span className="text-xs font-normal text-muted-foreground">kcal/day</span></div>
            <div className="text-[11px] text-muted-foreground mt-1">Target: {targetCal} kcal</div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex justify-between text-xs text-muted-foreground font-semibold mb-1">
              <span>Avg Protein</span>
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{current.avgProteinPerDay} <span className="text-xs font-normal text-muted-foreground">g/day</span></div>
            <div className="text-[11px] text-muted-foreground mt-1">Target: {targetProt} g</div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex justify-between text-xs text-muted-foreground font-semibold mb-1">
              <span>Avg Carbs</span>
              <TrendingUp className="h-3.5 w-3.5 text-sky-500" />
            </div>
            <div className="text-xl font-extrabold text-sky-600 dark:text-sky-400">{current.avgCarbsPerDay} <span className="text-xs font-normal text-muted-foreground">g/day</span></div>
            <div className="text-[11px] text-muted-foreground mt-1">Target: {targets?.carbs || 250} g</div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex justify-between text-xs text-muted-foreground font-semibold mb-1">
              <span>Avg Fat</span>
              <Flame className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{current.avgFatPerDay} <span className="text-xs font-normal text-muted-foreground">g/day</span></div>
            <div className="text-[11px] text-muted-foreground mt-1">Target: {targets?.fat || 65} g</div>
          </div>
        </div>
      </Card>

      {/* ALL MONTHS HISTORICAL COMPARISON TABLE */}
      {monthlyData.length > 1 && (
        <Card className="p-5 border border-border">
          <h4 className="font-bold text-sm text-foreground mb-4">Historical Monthly Performance</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3 rounded-l-lg">Month</th>
                  <th className="p-3">Days Logged</th>
                  <th className="p-3">Avg Calories</th>
                  <th className="p-3">Avg Protein</th>
                  <th className="p-3">Consistency</th>
                  <th className="p-3 rounded-r-lg">Status Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {monthlyData.map((m, idx) => (
                  <tr
                    key={m.monthKey}
                    onClick={() => setSelectedMonthIndex(idx)}
                    className={`cursor-pointer transition-colors ${
                      idx === selectedMonthIndex ? 'bg-primary/10 font-bold' : 'hover:bg-muted/30'
                    }`}
                  >
                    <td className="p-3 font-bold">{m.monthName}</td>
                    <td className="p-3">{m.daysLoggedCount} days</td>
                    <td className="p-3">{m.avgCaloriesPerDay} kcal</td>
                    <td className="p-3">{m.avgProteinPerDay} g</td>
                    <td className="p-3 font-bold text-primary">{m.consistencyScore}%</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {m.fitnessVerdict.badge}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
