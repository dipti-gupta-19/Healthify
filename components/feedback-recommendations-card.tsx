'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  ShieldAlert,
  Utensils,
  AlertTriangle,
  Leaf,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Scale,
  Target,
} from 'lucide-react';
import {
  generateFeedbackRecommendations,
  buildFeedbackInsights,
  type FeedbackRecommendation,
  type FeedbackInsightSummary,
  type RecommendationKind,
} from '@/lib/feedback-recommendations';
import type { LoggedMeal, UserProfile, NutritionTargets } from '@/lib/nutrition';
import { readLocalMeals } from '@/lib/meal-history';
import { useProfile } from '@/components/profile-context';

// ─── Kind metadata ─────────────────────────────────────────────────────────────

const KIND_META: Record<
  RecommendationKind,
  { label: string; Icon: React.ElementType; cardCls: string; badgeCls: string }
> = {
  allergy_warning: {
    label: 'Allergy Alert',
    Icon: ShieldAlert,
    cardCls: 'border-red-500/50 bg-red-500/10',
    badgeCls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  avoid_food: {
    label: 'Avoid',
    Icon: AlertTriangle,
    cardCls: 'border-orange-500/40 bg-orange-500/8',
    badgeCls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  avoid_ingredient: {
    label: 'Ingredient Warning',
    Icon: AlertTriangle,
    cardCls: 'border-amber-500/40 bg-amber-500/8',
    badgeCls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  liked_repeat: {
    label: 'Enjoy Again',
    Icon: ThumbsUp,
    cardCls: 'border-emerald-500/40 bg-emerald-500/8',
    badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  ingredient_safe: {
    label: 'Taste Pattern',
    Icon: Leaf,
    cardCls: 'border-teal-500/40 bg-teal-500/8',
    badgeCls: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  nutrition_gap: {
    label: 'Nutrition Gap',
    Icon: Target,
    cardCls: 'border-sky-500/40 bg-sky-500/8',
    badgeCls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  },
  balance: {
    label: 'Balance',
    Icon: Scale,
    cardCls: 'border-violet-500/40 bg-violet-500/8',
    badgeCls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
};

// ─── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({
  icon,
  label,
  value,
  color = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: 'green' | 'red' | 'amber' | 'default';
}) {
  const colorCls =
    color === 'green'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
      : color === 'red'
      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
      : color === 'amber'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
      : 'bg-muted/80 border-border text-foreground';
  return (
    <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 ${colorCls}`}>
      <span className="text-base">{icon}</span>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
        <div className="text-sm font-extrabold">{value}</div>
      </div>
    </div>
  );
}

// ─── Recommendation card ───────────────────────────────────────────────────────

function RecCard({ rec }: { rec: FeedbackRecommendation }) {
  const meta = KIND_META[rec.kind];
  const Icon = meta.Icon;
  return (
    <div
      className={`rounded-2xl border-2 p-4 space-y-2 transition-all hover:shadow-md ${meta.cardCls}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xl">{rec.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">{rec.title}</p>
        </div>
        <Badge
          className={`text-[10px] font-bold px-2 py-0.5 border-0 shrink-0 ${meta.badgeCls}`}
        >
          <Icon className="h-3 w-3 mr-1" />
          {meta.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{rec.body}</p>
    </div>
  );
}

// ─── Insights summary bar ──────────────────────────────────────────────────────

function InsightsSummary({ insights }: { insights: FeedbackInsightSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <StatChip
        icon={<ThumbsUp className="h-4 w-4 text-emerald-500" />}
        label="Meals Liked"
        value={insights.likedCount}
        color="green"
      />
      <StatChip
        icon={<ThumbsDown className="h-4 w-4 text-red-500" />}
        label="Issues Reported"
        value={insights.dislikedCount}
        color={insights.dislikedCount > 0 ? 'red' : 'default'}
      />
      <StatChip
        icon={<ShieldAlert className="h-4 w-4 text-amber-500" />}
        label="Allergy Flagged"
        value={insights.allergyFlagged ? 'Yes ⚠️' : 'None'}
        color={insights.allergyFlagged ? 'amber' : 'default'}
      />
      <StatChip
        icon={<TrendingUp className="h-4 w-4 text-sky-500" />}
        label="Total Feedbacks"
        value={insights.totalFeedbacks}
      />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function FeedbackRecommendationsCard({
  meals: propMeals,
  profile,
  targets,
}: {
  meals?: LoggedMeal[];
  profile: UserProfile;
  targets: NutritionTargets;
}) {
  const { token } = useProfile();
  const [recs, setRecs] = useState<FeedbackRecommendation[]>([]);
  const [insights, setInsights] = useState<FeedbackInsightSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const compute = useCallback(async () => {
    setLoading(true);
    try {
      // Try server-side first (has DB data)
      if (token) {
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        const res = await fetch('/api/meals/recommendations', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.recommendations?.length) {
            setRecs(data.recommendations);
            setInsights(data.insights);
            setLastRefreshed(new Date());
            return;
          }
        }
      }

      // Fallback: compute locally from localStorage
      const localMeals = propMeals ?? readLocalMeals();
      const localRecs = generateFeedbackRecommendations(localMeals, profile, targets);
      const localInsights = buildFeedbackInsights(localMeals);
      setRecs(localRecs);
      setInsights(localInsights);
      setLastRefreshed(new Date());
    } catch {
      // Compute locally on error
      const localMeals = propMeals ?? readLocalMeals();
      setRecs(generateFeedbackRecommendations(localMeals, profile, targets));
      setInsights(buildFeedbackInsights(localMeals));
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, [token, propMeals, profile, targets]);

  useEffect(() => {
    compute();
  }, [compute]);

  const visibleRecs = expanded ? recs : recs.slice(0, 3);

  // No feedback at all yet
  if (!loading && insights && insights.totalFeedbacks === 0) {
    return (
      <Card className="p-6 border-2 border-dashed border-primary/20 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base">Feedback-Driven Recommendations</h3>
            <p className="text-xs text-muted-foreground">Personalised food suggestions based on how you feel</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Utensils className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-muted-foreground">
            No feedback collected yet
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            After logging a meal, tap <strong>"How did you feel after eating?"</strong> to submit feedback. Your responses train personalised recommendations.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-2 border-primary/20 shadow-md glass-card space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base">Feedback-Driven Recommendations</h3>
            <p className="text-xs text-muted-foreground">
              Based on {insights?.totalFeedbacks ?? 0} meal feedback{insights?.totalFeedbacks !== 1 ? 's' : ''}
              {lastRefreshed && (
                <span className="ml-1 opacity-60">
                  · updated {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={compute}
          disabled={loading}
          className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
          id="refresh-feedback-recs-btn"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Insights summary bar */}
      {insights && insights.totalFeedbacks > 0 && (
        <InsightsSummary insights={insights} />
      )}

      {/* Top liked / avoid chips */}
      {insights && (insights.topLikedFoods.length > 0 || insights.topAvoidFoods.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {insights.topLikedFoods.length > 0 && (
            <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                👍 Foods You Enjoy
              </p>
              <div className="flex flex-wrap gap-1">
                {insights.topLikedFoods.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold capitalize text-emerald-800 dark:text-emerald-200"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          {insights.topAvoidFoods.length > 0 && (
            <div className="flex-1 rounded-xl bg-red-500/10 border border-red-500/30 p-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                👎 Foods to Avoid
              </p>
              <div className="flex flex-wrap gap-1">
                {insights.topAvoidFoods.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-red-500/20 border border-red-500/30 px-2.5 py-0.5 text-xs font-semibold capitalize text-red-800 dark:text-red-200"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations list */}
      {loading && recs.length === 0 ? (
        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Analysing your feedback...
        </div>
      ) : recs.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Personalised Suggestions ({recs.length})
          </p>
          {visibleRecs.map((rec) => (
            <RecCard key={rec.id} rec={rec} />
          ))}

          {recs.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
              id="toggle-all-feedback-recs-btn"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Show fewer
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Show {recs.length - 3} more
                </>
              )}
            </Button>
          )}
        </div>
      ) : null}

      {/* Liked ingredients chips */}
      {insights && insights.likedIngredients.length >= 3 && (
        <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
            🌿 Ingredients You Tend to Enjoy
          </p>
          <div className="flex flex-wrap gap-1.5">
            {insights.likedIngredients.slice(0, 8).map((ing) => (
              <span
                key={ing}
                className="rounded-full bg-teal-500/20 border border-teal-500/30 px-2.5 py-0.5 text-xs font-medium capitalize text-teal-800 dark:text-teal-200"
              >
                {ing}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
