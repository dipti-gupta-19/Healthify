'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HeartPulse, ChevronDown, Trash2, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { LoggedMeal, FeedbackSymptom } from '@/lib/nutrition';
import { classifyIngredient, isMealLiked } from '@/lib/nutrition';
import { toast } from 'sonner';
import { mealId } from '@/lib/meal-history';

const SYMPTOM_OPTIONS: { id: FeedbackSymptom; label: string }[] = [
  { id: 'nausea', label: 'Nausea' },
  { id: 'vomiting', label: 'Vomiting' },
  { id: 'rash', label: 'Rash' },
  { id: 'itching', label: 'Itching' },
  { id: 'stomach_pain', label: 'Stomach pain' },
  { id: 'diarrhea', label: 'Diarrhea' },
  { id: 'headache', label: 'Headache' },
  { id: 'bloating', label: 'Bloating' },
  { id: 'breathing_difficulty', label: 'Breathing difficulty' },
];

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

export function MealTimelineCard({
  meal,
  onDelete,
  onFeedbackSubmitted,
}: {
  meal: LoggedMeal;
  onDelete: (id: string) => void;
  onFeedbackSubmitted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [symptoms, setSymptoms] = useState<FeedbackSymptom[]>([]);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasFeedback = Boolean(meal.feedback);
  const enjoyed = isMealLiked(meal.feedback);

  const toggleSymptom = (symptom: FeedbackSymptom) => {
    setSymptoms((prev) => (prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]));
    setLiked(null);
  };

  const submitFeedback = async () => {
    setSubmitting(true);
    try {
      const isLiked = liked === true || (liked === null && symptoms.length === 0);
      const finalSymptoms: FeedbackSymptom[] = symptoms.length ? symptoms : ['none'];
      const severity = symptoms.some((s) => ['vomiting', 'rash', 'breathing_difficulty', 'diarrhea'].includes(s))
        ? 'severe'
        : symptoms.length > 1 ? 'moderate' : symptoms.length === 1 ? 'mild' : 'none';

      const res = await fetch('/api/meals/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' },
        body: JSON.stringify({
          mealId: mealId(meal),
          symptoms: finalSymptoms,
          severity,
          liked: isLiked && finalSymptoms[0] === 'none',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(isLiked ? 'Glad you enjoyed it!' : 'Feedback saved');
        setShowFeedback(false);
        onFeedbackSubmitted();
      } else {
        toast.error(data.error || 'Failed to submit');
      }
    } catch {
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <span className="text-3xl">{meal.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold capitalize">{meal.foodName}</h3>
            <Badge variant="outline" className="capitalize text-xs">
              {MEAL_ICONS[meal.mealType]} {meal.mealType}
            </Badge>
            {hasFeedback && (
              <Badge variant={enjoyed ? 'default' : 'destructive'} className="text-xs">
                {enjoyed ? '👍 Enjoyed' : '👎 Issues reported'}
              </Badge>
            )}
            {meal.isJunkFood && <Badge variant="secondary" className="text-xs">🍟 Junk food</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(meal.loggedAt).toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
            {' · '}{meal.facts.calories} kcal · {meal.facts.protein}g protein · {meal.facts.fat}g fat
          </p>
          {meal.portionAdvice && (
            <p className="text-xs text-warning mt-1">{meal.portionAdvice}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Toggle details"
          >
            <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => onDelete(mealId(meal))}
            className="rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <NutrientMini label="Cal" value={meal.facts.calories} unit="kcal" />
            <NutrientMini label="Protein" value={meal.facts.protein} unit="g" />
            <NutrientMini label="Carbs" value={meal.facts.carbs} unit="g" />
            <NutrientMini label="Fat" value={meal.facts.fat} unit="g" />
            <NutrientMini label="Sugar" value={meal.facts.sugar} unit="g" warn={meal.facts.sugar > 10} />
            <NutrientMini label="Fiber" value={meal.facts.fiber} unit="g" good={meal.facts.fiber >= 3} />
            <NutrientMini label="Sodium" value={meal.facts.sodium} unit="mg" warn={meal.facts.sodium > 400} />
          </div>

          {meal.beneficialAspects && meal.beneficialAspects.length > 0 && (
            <div className="rounded-lg border border-success/40 bg-success/10 p-3">
              <p className="text-xs font-bold text-success mb-2">✅ Beneficial</p>
              <div className="flex flex-wrap gap-1">
                {meal.beneficialAspects.map((b) => (
                  <span key={b} className="rounded-full bg-success/15 border border-success/30 px-2 py-0.5 text-xs text-success">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(meal.harmfulAdditives?.length || meal.healthConcerns?.length || meal.warnings.length) && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs font-bold text-destructive mb-2">⚠️ Harmful / concerns</p>
              <div className="space-y-1">
                {meal.harmfulAdditives?.map((h) => (
                  <p key={h} className="text-xs text-destructive/90">• {h}</p>
                ))}
                {meal.healthConcerns?.map((c) => (
                  <p key={c} className="text-xs text-destructive/80">• {c}</p>
                ))}
                {meal.warnings.map((w) => (
                  <p key={w} className="text-xs text-destructive/80">• {w}</p>
                ))}
              </div>
            </div>
          )}

          {meal.ingredients && meal.ingredients.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5">All ingredients</p>
              <div className="flex flex-wrap gap-1">
                {meal.ingredients.map((ing, i) => {
                  const kind = classifyIngredient(ing);
                  const cls = kind === 'harmful'
                    ? 'bg-destructive/15 border-destructive/40 text-destructive'
                    : kind === 'beneficial'
                      ? 'bg-success/15 border-success/40 text-success'
                      : 'bg-muted border-border';
                  return (
                    <span key={i} className={`rounded-md border px-2 py-0.5 text-xs ${cls}`}>
                      {ing}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {!hasFeedback && !showFeedback && (
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setShowFeedback(true)}>
              <HeartPulse className="h-4 w-4" />
              How did you feel after eating?
            </Button>
          )}

          {hasFeedback && meal.feedback && (
            <div className="rounded-lg bg-muted/60 p-3 text-xs">
              <p className="font-semibold mb-1">Your feedback</p>
              {enjoyed ? (
                <p className="text-success">👍 You enjoyed this meal</p>
              ) : (
                <p className="text-destructive">
                  Symptoms: {meal.feedback.symptoms.filter((s) => s !== 'none').join(', ') || 'Not enjoyed'}
                </p>
              )}
              <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs" onClick={() => setShowFeedback(true)}>
                Update feedback
              </Button>
            </div>
          )}
        </div>
      )}

      {showFeedback && (
        <div className="border-t bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-sm">How did you feel after eating?</h4>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={liked === true ? 'default' : 'outline'}
              className="gap-1"
              onClick={() => { setLiked(true); setSymptoms([]); }}
            >
              <ThumbsUp className="h-3 w-3" /> Loved it
            </Button>
            <Button
              size="sm"
              variant={liked === false ? 'destructive' : 'outline'}
              className="gap-1"
              onClick={() => { setLiked(false); }}
            >
              <ThumbsDown className="h-3 w-3" /> Didn&apos;t like
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Any symptoms? (optional)</p>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOM_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleSymptom(s.id)}
                className={`rounded-full px-2.5 py-1 text-xs border transition ${
                  symptoms.includes(s.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submitFeedback} disabled={submitting} className="flex-1">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowFeedback(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function NutrientMini({ label, value, unit, warn, good }: {
  label: string; value: number; unit: string; warn?: boolean; good?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2 ${warn ? 'bg-destructive/10' : good ? 'bg-success/10' : 'bg-muted/60'}`}>
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-bold ${warn ? 'text-destructive' : good ? 'text-success' : ''}`}>
        {value}{unit}
      </div>
    </div>
  );
}
