/**
 * feedback-recommendations.ts
 *
 * Pure utility — processes logged meal + feedback data to produce
 * personalised food recommendations and avoidance signals.
 */

import type { LoggedMeal, UserProfile, NutritionTargets, FeedbackSymptom } from '@/lib/nutrition';
import { isMealLiked } from '@/lib/nutrition';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationKind =
  | 'liked_repeat'
  | 'ingredient_safe'
  | 'avoid_food'
  | 'avoid_ingredient'
  | 'nutrition_gap'
  | 'balance'
  | 'allergy_warning';

export interface FeedbackRecommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  body: string;
  emoji: string;
  priority: number; // lower = more important; 1 is critical
  foodName?: string;
  ingredient?: string;
}

export interface FeedbackInsightSummary {
  totalFeedbacks: number;
  likedCount: number;
  dislikedCount: number;
  symptomsReported: FeedbackSymptom[];
  allergyFlagged: boolean;
  poisoningFlagged: boolean;
  topLikedFoods: string[];
  topAvoidFoods: string[];
  likedIngredients: string[];
  avoidIngredients: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectIngredients(meals: LoggedMeal[]): string[] {
  const all: string[] = [];
  for (const m of meals) {
    for (const ing of m.ingredients ?? []) {
      const clean = ing.toLowerCase().trim();
      if (clean.length > 2) all.push(clean);
    }
  }
  return all;
}

function frequency<T>(items: T[]): Map<T, number> {
  const map = new Map<T, number>();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return map;
}

function topN<T>(map: Map<T, number>, n: number): T[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/** Build a summary of what the user has reported via feedback. */
export function buildFeedbackInsights(meals: LoggedMeal[]): FeedbackInsightSummary {
  const withFeedback = meals.filter((m) => m.feedback);

  const liked = withFeedback.filter((m) => isMealLiked(m.feedback));
  const disliked = withFeedback.filter((m) => !isMealLiked(m.feedback));

  const allSymptoms: FeedbackSymptom[] = withFeedback.flatMap(
    (m) => m.feedback!.symptoms.filter((s) => s !== 'none'),
  );
  const uniqueSymptoms = [...new Set(allSymptoms)] as FeedbackSymptom[];

  const likedIngMap = frequency(collectIngredients(liked));
  const dislikedIngMap = frequency(collectIngredients(disliked));

  const safeIngredients = topN(likedIngMap, 10).filter(
    (ing) => !dislikedIngMap.has(ing),
  );

  const allergyFlagged = withFeedback.some((m) => m.feedback?.suspectedAllergy);
  const poisoningFlagged = withFeedback.some((m) => m.feedback?.suspectedFoodPoisoning);

  return {
    totalFeedbacks: withFeedback.length,
    likedCount: liked.length,
    dislikedCount: disliked.length,
    symptomsReported: uniqueSymptoms,
    allergyFlagged,
    poisoningFlagged,
    topLikedFoods: liked.slice(0, 5).map((m) => m.foodName),
    topAvoidFoods: disliked.slice(0, 5).map((m) => m.foodName),
    likedIngredients: safeIngredients,
    avoidIngredients: topN(dislikedIngMap, 8),
  };
}

/** Generate ranked, actionable recommendations from meal + feedback history. */
export function generateFeedbackRecommendations(
  meals: LoggedMeal[],
  profile: UserProfile,
  targets: NutritionTargets,
): FeedbackRecommendation[] {
  const withFeedback = meals.filter((m) => m.feedback);
  if (withFeedback.length === 0) return [];

  const recs: FeedbackRecommendation[] = [];
  let idCounter = 0;
  const uid = () => `frec_${++idCounter}`;

  const liked = withFeedback.filter((m) => isMealLiked(m.feedback));
  const disliked = withFeedback.filter((m) => !isMealLiked(m.feedback));
  const isVeg = profile.dietType === 'vegetarian';

  // 1. Allergy / severe reaction warnings
  for (const meal of withFeedback) {
    const fb = meal.feedback!;
    if (fb.suspectedAllergy) {
      const ings = (meal.ingredients ?? []).slice(0, 3).join(', ') || 'unknown ingredients';
      recs.push({
        id: uid(),
        kind: 'allergy_warning',
        title: `Possible allergy: ${meal.foodName}`,
        body: `You reported ${fb.symptoms.filter((s) => s !== 'none').join(', ')} after eating ${meal.foodName}. Suspect ingredients: ${ings}. Avoid this food and consult a doctor.`,
        emoji: '🚨',
        priority: 1,
        foodName: meal.foodName,
      });
    }
    if (fb.suspectedFoodPoisoning && !fb.suspectedAllergy) {
      recs.push({
        id: uid(),
        kind: 'avoid_food',
        title: `Avoid: ${meal.foodName} caused discomfort`,
        body: `Symptoms (${fb.symptoms.filter((s) => s !== 'none').join(', ')}) after eating ${meal.foodName} suggest possible food poisoning. Avoid until symptoms clear.`,
        emoji: '🤢',
        priority: 2,
        foodName: meal.foodName,
      });
    }
  }

  // 2. Avoid foods that consistently caused symptoms
  const problemFoods = disliked.filter((m) => {
    const syms = m.feedback!.symptoms.filter((s) => s !== 'none');
    return syms.length > 0 && !m.feedback?.suspectedAllergy;
  });
  for (const meal of problemFoods.slice(0, 2)) {
    const syms = meal.feedback!.symptoms.filter((s) => s !== 'none').join(', ');
    recs.push({
      id: uid(),
      kind: 'avoid_food',
      title: `Limit: ${meal.foodName}`,
      body: `You reported ${syms} after eating ${meal.foodName}. Consider reducing portion size or avoiding it for a while.`,
      emoji: '⛔',
      priority: 3,
      foodName: meal.foodName,
    });
  }

  // 3. Ingredients linked to symptoms
  const problemIngMap = frequency(
    collectIngredients(disliked.filter((m) =>
      (m.feedback?.symptoms ?? []).some((s) => s !== 'none'),
    )),
  );
  const topProblemIngs = topN(problemIngMap, 5);
  for (const ing of topProblemIngs.slice(0, 2)) {
    recs.push({
      id: uid(),
      kind: 'avoid_ingredient',
      title: `Watch out for: ${ing}`,
      body: `"${ing}" appears in meals where you reported symptoms. Check labels and reduce meals containing it.`,
      emoji: '🔍',
      priority: 4,
      ingredient: ing,
    });
  }

  // 4. Liked food repeats
  for (const meal of liked.slice(0, 2)) {
    recs.push({
      id: uid(),
      kind: 'liked_repeat',
      title: `Have ${meal.foodName} again`,
      body: `You loved ${meal.foodName} (${meal.facts.calories} kcal, ${meal.facts.protein}g protein). It suits your taste and fits your ${profile.goal} goal.`,
      emoji: meal.emoji || '😋',
      priority: 5,
      foodName: meal.foodName,
    });
  }

  // 5. Safe ingredient-based suggestions
  const likedIngMap = frequency(collectIngredients(liked));
  const safeIngs = topN(likedIngMap, 10).filter(
    (ing) => !topProblemIngs.includes(ing) && ing.length > 3,
  );
  if (safeIngs.length >= 2) {
    const sample = safeIngs.slice(0, 3).join(', ');
    const foodSuggestion = isVeg
      ? 'dal, paneer dishes, or vegetable curries'
      : 'grilled chicken, fish curry, or egg-based dishes';
    recs.push({
      id: uid(),
      kind: 'ingredient_safe',
      title: 'Foods you tend to enjoy',
      body: `Your liked meals often contain: ${sample}. Look for ${foodSuggestion} that feature these ingredients.`,
      emoji: '✅',
      priority: 6,
    });
  }

  // 6. Nutrition gaps from liked meals
  if (liked.length >= 2) {
    const avgProtein = liked.reduce((s, m) => s + m.facts.protein, 0) / liked.length;
    const avgFiber = liked.reduce((s, m) => s + m.facts.fiber, 0) / liked.length;

    if (avgProtein < targets.protein * 0.25) {
      recs.push({
        id: uid(),
        kind: 'nutrition_gap',
        title: 'Your liked meals are low in protein',
        body: `On average your enjoyed meals provide only ${Math.round(avgProtein)}g protein. ${isVeg ? 'Try adding dal, paneer, or curd.' : 'Add eggs, grilled chicken, or fish.'}`,
        emoji: '💪',
        priority: 7,
      });
    }

    if (avgFiber < 3) {
      recs.push({
        id: uid(),
        kind: 'nutrition_gap',
        title: 'Boost fiber in your favourite meals',
        body: `Your enjoyed meals average only ${Math.round(avgFiber)}g fiber. Add a side salad, rajma, or fruit to balance your favourite dishes.`,
        emoji: '🥗',
        priority: 8,
      });
    }
  }

  // 7. Balance suggestion if only junk food liked
  const likedJunk = liked.filter((m) => m.isJunkFood);
  if (likedJunk.length >= 2 && likedJunk.length === liked.length) {
    recs.push({
      id: uid(),
      kind: 'balance',
      title: 'Mix in some wholesome meals',
      body: `Most of the meals you enjoyed were processed snacks. Try balancing with ${isVeg ? 'a home-cooked dal, sabzi, or fruit' : 'grilled protein, salad, or soup'} on alternate days.`,
      emoji: '⚖️',
      priority: 9,
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

/** Convenience alias for API routes that use plain objects. */
export function generateFeedbackRecommendationsFromRaw(
  meals: unknown[],
  profile: UserProfile,
  targets: NutritionTargets,
): FeedbackRecommendation[] {
  return generateFeedbackRecommendations(meals as LoggedMeal[], profile, targets);
}
