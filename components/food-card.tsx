'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, XCircle, MinusCircle, Plus, Loader2 } from 'lucide-react';
import type { FoodAnalysis, UserProfile, NutritionTargets } from '@/lib/nutrition';
import { toast } from 'sonner';

const VERDICT_CONFIG = {
  great: { label: 'Great Choice', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  good: { label: 'Good', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/5', border: 'border-success/20' },
  moderate: { label: 'Moderate', icon: MinusCircle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  poor: { label: 'Avoid', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
};

export function FoodCard({
  analysis,
  profile,
  targets,
}: {
  analysis: FoodAnalysis;
  profile: UserProfile | null;
  targets: NutritionTargets | null;
}) {
  const [addToMeal, setAddToMeal] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  const verdict = VERDICT_CONFIG[analysis.verdict];
  const VerdictIcon = verdict.icon;

  const handleLog = async () => {
    if (!addToMeal) return;
    setLogging(true);
    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' },
        body: JSON.stringify({
          foodName: analysis.name,
          emoji: analysis.emoji,
          facts: analysis.facts,
          verdict: analysis.verdict,
          warnings: analysis.warnings,
        }),
      });
      if (res.ok) {
        setLogged(true);
        toast.success(`${analysis.name} added to your meals!`);
      }
    } catch {
      toast.error('Failed to log meal');
    } finally {
      setLogging(false);
    }
  };


  return (
    <Card className={`overflow-hidden animate-scale-in border-2 ${verdict.border}`}>
      <div className={`flex items-center gap-3 p-5 ${verdict.bg}`}>
        <span className="text-4xl">{analysis.emoji}</span>
        <div className="flex-1">
          <h3 className="text-xl font-bold capitalize">{analysis.name}</h3>
          <div className={`flex items-center gap-1.5 font-semibold ${verdict.color}`}>
            <VerdictIcon className="h-4 w-4" />
            {verdict.label}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {analysis.warnings.length > 0 && (
          <div className="space-y-2">
            {analysis.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {analysis.harmfulAdditives.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-destructive">Harmful Additives Detected</h4>
            <div className="space-y-1">
              {analysis.harmfulAdditives.map((a, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-destructive mt-0.5">•</span> {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.allergens.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-destructive">Allergens:</span>
            {analysis.allergens.map((a) => (
              <Badge key={a} variant="destructive">{a}</Badge>
            ))}
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-3">Nutrition Facts</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              { label: 'Calories', value: analysis.facts.calories, unit: 'kcal', target: targets?.calories },
              { label: 'Protein', value: analysis.facts.protein, unit: 'g', target: targets?.protein },
              { label: 'Carbs', value: analysis.facts.carbs, unit: 'g', target: targets?.carbs },
              { label: 'Fat', value: analysis.facts.fat, unit: 'g', target: targets?.fat },
              { label: 'Fiber', value: analysis.facts.fiber, unit: 'g', target: targets?.fiber },
              { label: 'Sugar', value: analysis.facts.sugar, unit: 'g', target: targets?.sugarMax },
              { label: 'Sodium', value: analysis.facts.sodium, unit: 'mg', target: targets?.sodiumMax },
            ]).map((n) => (
              <div key={n.label} className="rounded-lg bg-muted p-3">
                <div className="text-lg font-bold">{n.value}<span className="text-xs font-normal text-muted-foreground ml-0.5">{n.unit}</span></div>
                <div className="text-xs text-muted-foreground">{n.label}</div>
                {n.target && (
                  <div className="h-1 mt-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (n.value / (n.target || 1)) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {analysis.ingredients && analysis.ingredients.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Ingredients</h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.ingredients.slice(0, 20).map((ing, i) => (
                <span key={i} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{ing}</span>
              ))}
            </div>
          </div>
        )}

        {analysis.recommendation && (
          <div className="rounded-lg bg-secondary/50 p-3 text-sm text-secondary-foreground">
            <span className="font-semibold">Recommendation: </span>{analysis.recommendation}
          </div>
        )}

        <div className="border-t border-border pt-4 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox checked={addToMeal} onCheckedChange={(v) => setAddToMeal(v === true)} id="add-meal" />
            <span className="text-sm font-medium">Add this to my meals today</span>
          </label>
          <Button
            onClick={handleLog}
            disabled={!addToMeal || logging || logged}
            className="w-full gap-2"
          >
            {logged ? (
              <>Logged! View Dashboard</>
            ) : logging ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Logging...</>
            ) : addToMeal ? (
              <><Plus className="h-4 w-4" /> Log this meal</>
            ) : (
              'Check the box to log this meal'
            )}
          </Button>
          {!addToMeal && (
            <p className="text-xs text-center text-muted-foreground">
              Just exploring? Leave unchecked — this is for information only.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
