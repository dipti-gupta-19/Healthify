export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'loss' | 'maintain' | 'gain';
export type MedicalCondition = 'none' | 'diabetes' | 'hypertension' | 'cholesterol' | 'pcos';

export interface UserProfile {
  name: string;
  age: number;
  sex: Sex;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  medicalConditions: MedicalCondition[];
  allergies: string[];
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugarMax: number;
  sodiumMax: number;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<Goal, { calories: number; proteinPerKg: number }> = {
  loss: { calories: -500, proteinPerKg: 1.6 },
  maintain: { calories: 0, proteinPerKg: 1.2 },
  gain: { calories: 400, proteinPerKg: 2.0 },
};

export function calculateBMR(profile: UserProfile): number {
  const { weightKg, heightCm, age, sex } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function calculateTargets(profile: UserProfile): NutritionTargets {
  const bmr = calculateBMR(profile);
  const tdee = bmr * ACTIVITY_FACTORS[profile.activityLevel];
  const adj = GOAL_ADJUSTMENTS[profile.goal];
  const calories = Math.round(tdee + adj.calories);
  const protein = Math.round(profile.weightKg * adj.proteinPerKg);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  let sugarMax = Math.round((calories * 0.1) / 4);
  let sodiumMax = 2300;
  const fiber = Math.round((calories / 1000) * 14);

  for (const cond of profile.medicalConditions) {
    if (cond === 'diabetes') {
      sugarMax = Math.min(sugarMax, 25);
    }
    if (cond === 'hypertension') {
      sodiumMax = 1500;
    }
    if (cond === 'cholesterol') {
      sugarMax = Math.min(sugarMax, 30);
    }
  }

  return { calories, protein, carbs, fat, fiber, sugarMax, sodiumMax };
}

export interface NutritionFacts {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

export type Verdict = 'great' | 'good' | 'moderate' | 'poor';

export interface FoodAnalysis {
  name: string;
  emoji: string;
  facts: NutritionFacts;
  verdict: Verdict;
  warnings: string[];
  allergens: string[];
  harmfulAdditives: string[];
  ingredients?: string[];
  recommendation?: string;
}

const HARMFUL_ADDITIVES: Record<string, string> = {
  'trans fat': 'Trans fats raise bad cholesterol and lower good cholesterol',
  'partially hydrogenated': 'Partially hydrogenated oils contain trans fats',
  'high fructose corn syrup': 'Linked to obesity and insulin resistance',
  'sodium nitrite': 'Preservative linked to cancer risk in processed meats',
  'sodium nitrate': 'Preservative linked to cancer risk',
  'bha': 'Butylated hydroxyanisole — possible carcinogen',
  'bht': 'Butylated hydroxytoluene — possible carcinogen',
  'msg': 'Monosodium glutamate — may cause sensitivity reactions',
  'tartrazine': 'Artificial dye — linked to hyperactivity',
  'red 40': 'Artificial dye — linked to hyperactivity in children',
  'yellow 5': 'Artificial dye — linked to hyperactivity',
  'sodium benzoate': 'Preservative — may form benzene with vitamin C',
  'potassium bromate': 'Flour improver banned in many countries',
};

export function checkHarmfulAdditives(ingredients: string[]): string[] {
  const found: string[] = [];
  const lower = ingredients.map((i) => i.toLowerCase());
  for (const [key, label] of Object.entries(HARMFUL_ADDITIVES)) {
    if (lower.some((i) => i.includes(key))) {
      found.push(label);
    }
  }
  return found;
}

export function checkAllergens(ingredients: string[], allergies: string[]): string[] {
  const found: string[] = [];
  const lower = ingredients.map((i) => i.toLowerCase());
  for (const allergy of allergies) {
    const a = allergy.toLowerCase().trim();
    if (a && lower.some((i) => i.includes(a))) {
      found.push(allergy);
    }
  }
  return found;
}

export function analyzeFood(
  name: string,
  facts: NutritionFacts,
  profile: UserProfile,
  ingredients: string[] = [],
): FoodAnalysis {
  const warnings: string[] = [];
  const allergens = checkAllergens(ingredients, profile.allergies);
  const harmfulAdditives = checkHarmfulAdditives(ingredients);
  const targets = calculateTargets(profile);

  if (allergens.length > 0) {
    warnings.push(`Contains allergen(s): ${allergens.join(', ')}`);
  }
  if (harmfulAdditives.length > 0) {
    warnings.push(`${harmfulAdditives.length} harmful additive(s) detected`);
  }
  for (const cond of profile.medicalConditions) {
    if (cond === 'diabetes' && facts.sugar > 10) {
      warnings.push(`High sugar (${facts.sugar}g) — risky for diabetes`);
    }
    if (cond === 'hypertension' && facts.sodium > 400) {
      warnings.push(`High sodium (${facts.sodium}mg) — risky for hypertension`);
    }
    if (cond === 'cholesterol' && facts.fat > 15) {
      warnings.push(`High fat (${facts.fat}g) — watch for cholesterol`);
    }
  }

  let score = 0;
  if (facts.protein >= 10) score++;
  if (facts.fiber >= 3) score++;
  if (facts.sugar <= targets.sugarMax / 3) score++;
  if (facts.sodium <= targets.sodiumMax / 3) score++;
  if (harmfulAdditives.length === 0) score++;
  if (allergens.length === 0) score++;
  if (warnings.length > 0) score--;

  let verdict: Verdict;
  if (score >= 5) verdict = 'great';
  else if (score >= 3) verdict = 'good';
  else if (score >= 1) verdict = 'moderate';
  else verdict = 'poor';

  let recommendation = '';
  if (verdict === 'poor' || warnings.length > 0) {
    recommendation = 'Consider a healthier alternative or smaller portion.';
  } else if (verdict === 'moderate') {
    recommendation = 'Okay in moderation — balance with lighter meals later.';
  } else {
    recommendation = 'Great choice — fits well into your daily plan.';
  }

  return {
    name,
    emoji: '🍽️',
    facts,
    verdict,
    warnings,
    allergens,
    harmfulAdditives,
    ingredients,
    recommendation,
  };
}

export interface LoggedMeal {
  _id?: string;
  userId: string;
  foodName: string;
  emoji: string;
  facts: NutritionFacts;
  verdict: Verdict;
  loggedAt: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  warnings: string[];
}

export interface DailySummary {
  consumed: NutritionFacts;
  targets: NutritionTargets;
  remaining: NutritionFacts;
  meals: LoggedMeal[];
  gapWarnings: string[];
}

export function emptyFacts(): NutritionFacts {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
}

export function sumFacts(meals: LoggedMeal[]): NutritionFacts {
  return meals.reduce((acc, m) => ({
    calories: acc.calories + m.facts.calories,
    protein: acc.protein + m.facts.protein,
    carbs: acc.carbs + m.facts.carbs,
    fat: acc.fat + m.facts.fat,
    fiber: acc.fiber + m.facts.fiber,
    sugar: acc.sugar + m.facts.sugar,
    sodium: acc.sodium + m.facts.sodium,
  }), emptyFacts());
}

export function detectGaps(meals: LoggedMeal[]): string[] {
  const warnings: string[] = [];
  const now = new Date();
  const todayMeals = meals
    .filter((m) => {
      const d = new Date(m.loggedAt);
      return d.toDateString() === now.toDateString();
    })
    .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());

  if (todayMeals.length === 0) return warnings;

  const hour = now.getHours();
  const hasBreakfast = todayMeals.some((m) => m.mealType === 'breakfast');
  if (hour >= 11 && !hasBreakfast) warnings.push('Breakfast skipped — eating late may slow metabolism');

  for (let i = 1; i < todayMeals.length; i++) {
    const prev = new Date(todayMeals[i - 1].loggedAt).getTime();
    const curr = new Date(todayMeals[i].loggedAt).getTime();
    const gapHours = (curr - prev) / (1000 * 60 * 60);
    if (gapHours > 6) warnings.push(`Long gap (${Math.round(gapHours)}h) between meals`);
  }

  const lastMeal = todayMeals[todayMeals.length - 1];
  if (new Date(lastMeal.loggedAt).getHours() >= 22) {
    warnings.push('Late-night eating detected — may affect sleep');
  }

  return warnings;
}

export function getMealType(hour: number): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  return 'dinner';
}
