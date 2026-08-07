'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, MinusCircle, Plus, Loader2, HeartPulse, ChevronDown } from 'lucide-react';
import { useProfile } from '@/components/profile-context';
import type { FoodAnalysis, UserProfile, NutritionTargets, FeedbackSymptom } from '@/lib/nutrition';
import { toast } from 'sonner';

const VERDICT_CONFIG = {
  great: { label: 'Great Choice', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  good: { label: 'Good', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/5', border: 'border-success/20' },
  moderate: { label: 'Moderate', icon: MinusCircle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  poor: { label: 'Avoid', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
};

const SYMPTOM_OPTIONS: { id: FeedbackSymptom; label: string }[] = [
  { id: 'none', label: 'No issues' },
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

export function FoodCard({
  analysis,
  profile,
  targets,
  onLogged,
}: {
  analysis: FoodAnalysis;
  profile: UserProfile | null;
  targets: NutritionTargets | null;
  onLogged?: () => void;
}) {
  const { refresh } = useProfile();
  const [addToMeal, setAddToMeal] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [mealId, setMealId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [symptoms, setSymptoms] = useState<FeedbackSymptom[]>([]);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const verdict = VERDICT_CONFIG[analysis.verdict];
  const VerdictIcon = verdict.icon;
  const calPct = targets ? Math.min(100, (analysis.facts.calories / targets.calories) * 100) : 0;
  const fatPct = targets ? Math.min(100, (analysis.facts.fat / targets.fat) * 100) : 0;

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
          ingredients: analysis.ingredients || [],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLogged(true);
        setMealId(data._id);
        setShowFeedback(true);
        toast.success(`${analysis.name} added to your meals!`);
      } else {
        toast.error(data.error || 'Failed to log meal');
      }
    } catch {
      toast.error('Failed to log meal');
    } finally {
      setLogging(false);
    }
  };

  const toggleSymptom = (symptom: FeedbackSymptom) => {
    if (symptom === 'none') {
      setSymptoms(['none']);
      return;
    }
    setSymptoms((prev) => {
      const without = prev.filter((s) => s !== 'none' && s !== symptom);
      if (prev.includes(symptom)) return without;
      return [...without, symptom];
    });
  };

  const submitFeedback = async () => {
    if (!mealId) return;
    setSubmittingFeedback(true);
    try {
      const severity = symptoms.some((s) => ['vomiting', 'rash', 'breathing_difficulty', 'diarrhea'].includes(s))
        ? 'severe'
        : symptoms.length > 1 ? 'moderate' : symptoms.length === 1 && symptoms[0] !== 'none' ? 'mild' : 'none';

      const res = await fetch('/api/meals/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' },
        body: JSON.stringify({ mealId, symptoms: symptoms.length ? symptoms : ['none'], severity, notes: feedbackNotes }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMessage(data.message);
        if (data.suspectedAllergy) {
          toast.error('Possible allergic reaction — ingredient flagged.');
          await refresh();
        } else if (data.suspectedFoodPoisoning) {
          toast.warning('Possible food poisoning — seek help if severe.');
        } else {
          toast.success('Feedback recorded!');
        }
        setShowFeedback(false);
      } else {
        toast.error(data.error || 'Failed to submit feedback');
      }
    } catch {
      toast.error('Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <Card className={`overflow-hidden border-2 ${verdict.border}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 p-4 ${verdict.bg}`}>
        <span className="text-4xl">{analysis.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold capitalize truncate">{analysis.name}</h3>
          <div className={`flex items-center gap-1.5 font-semibold ${verdict.color}`}>
            <VerdictIcon className="h-4 w-4" />
            {verdict.label}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* BIG diet alerts for vegetarians */}
        {analysis.dietAlerts && analysis.dietAlerts.length > 0 && (
          <div className="space-y-2">
            {analysis.dietAlerts.map((alert) => (
              <div
                key={alert.type}
                className="rounded-2xl border-2 border-destructive bg-destructive/15 p-4 text-center animate-scale-in"
              >
                <div className="text-4xl mb-2">{alert.emoji}</div>
                <div className="text-lg font-bold text-destructive">{alert.label}</div>
                <p className="text-sm font-medium text-destructive/90 mt-1">{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-2">Are you okay eating this?</p>
              </div>
            ))}
          </div>
        )}

        {/* Quick one-line summary */}
        {analysis.quickSummary && (
          <p className="text-center text-sm font-medium text-foreground bg-muted/60 rounded-xl px-4 py-3">
            {analysis.quickSummary}
          </p>
        )}

        {/* Visual tag chips — max 4 */}
        {analysis.highlightTags && analysis.highlightTags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {analysis.highlightTags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Visual nutrition bars — 4 key numbers */}
        <div className="grid grid-cols-2 gap-3">
          <NutrientBar label="Calories" value={analysis.facts.calories} unit="kcal" pct={calPct} warn={calPct > 40} />
          <NutrientBar label="Protein" value={analysis.facts.protein} unit="g" pct={targets ? (analysis.facts.protein / targets.protein) * 100 : 0} />
          <NutrientBar label="Fat" value={analysis.facts.fat} unit="g" pct={fatPct} warn={fatPct > 40} />
          <NutrientBar label="Sugar" value={analysis.facts.sugar} unit="g" pct={targets ? (analysis.facts.sugar / targets.sugarMax) * 100 : 0} warn={analysis.facts.sugar > 10} />
        </div>

        {/* Portion tip — single line */}
        {analysis.portionAdvice && (
          <div className="flex items-center gap-2 rounded-xl bg-warning/10 border border-warning/30 px-3 py-2 text-sm">
            <span className="text-lg">📦</span>
            <span className="text-warning font-medium">{analysis.portionAdvice.split('—')[0].trim()}</span>
          </div>
        )}

        {/* Collapsible details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {showDetails ? 'Hide details' : 'More details'}
          <ChevronDown className={`h-3 w-3 transition ${showDetails ? 'rotate-180' : ''}`} />
        </button>

        {showDetails && (
          <div className="space-y-3 text-sm border-t pt-3">
            {analysis.allergens.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {analysis.allergens.map((a) => <Badge key={a} variant="destructive">{a}</Badge>)}
              </div>
            )}
            {analysis.ingredients && analysis.ingredients.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {analysis.ingredients.slice(0, 12).map((ing, i) => (
                  <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-xs">{ing}</span>
                ))}
              </div>
            )}
            {analysis.healthConcerns?.map((c, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {c}</p>
            ))}
          </div>
        )}

        {/* Log meal */}
        <div className="border-t pt-4 space-y-3">
          {!logged && (
            <>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox checked={addToMeal} onCheckedChange={(v) => setAddToMeal(v === true)} />
                <span className="text-sm font-medium">Add this to my meals today</span>
              </label>
              <Button onClick={handleLog} disabled={!addToMeal || logging} className="w-full gap-2">
                {logging ? <><Loader2 className="h-4 w-4 animate-spin" /> Logging...</> : addToMeal ? <><Plus className="h-4 w-4" /> Log this meal</> : 'Check the box to log'}
              </Button>
            </>
          )}

          {showFeedback && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">How did you feel after eating?</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggleSymptom(s.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                      symptoms.includes(s.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={submitFeedback} disabled={submittingFeedback} className="flex-1">
                  {submittingFeedback ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
                </Button>
                <Button variant="outline" onClick={() => { setShowFeedback(false); onLogged?.(); }}>Skip</Button>
              </div>
            </div>
          )}

          {logged && !showFeedback && (
            <Button onClick={() => onLogged?.()} className="w-full">View Dashboard</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function NutrientBar({ label, value, unit, pct, warn }: { label: string; value: number; unit: string; pct: number; warn?: boolean }) {
  const clamped = Math.min(100, pct);
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="font-bold">{value}{unit}</span>
      </div>
      <div className="h-2 rounded-full bg-background overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${warn ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
