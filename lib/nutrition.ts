export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'loss' | 'maintain' | 'gain';
export type MedicalCondition = 'none' | 'diabetes' | 'hypertension' | 'cholesterol' | 'pcos';
export type DietType = 'vegetarian' | 'non_vegetarian';

export interface UserProfile {
  name: string;
  age: number;
  sex: Sex;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  dietType: DietType;
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
    if (cond === 'pcos') {
      sugarMax = Math.min(sugarMax, 20);
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
  isJunkFood?: boolean;
  junkFoodLabel?: string;
  healthConcerns?: string[];
  whyLimit?: string[];
  portionAdvice?: string;
  servingLabel?: string;
  dietAlerts?: DietAlert[];
  quickSummary?: string;
  highlightTags?: string[];
}

export interface DietAlert {
  type: 'egg' | 'meat' | 'fish';
  label: string;
  emoji: string;
  message: string;
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

const PROCESSED_INGREDIENTS: Record<string, string> = {
  'palm oil': 'High in saturated fat — raises heart disease risk when eaten regularly',
  'vegetable oil': 'Refined oil in snacks adds empty calories with little nutrition',
  'sunflower oil': 'Often used in fried snacks — high calorie, low nutrients',
  'maltodextrin': 'Processed starch that spikes blood sugar faster than sugar',
  'dextrose': 'Pure sugar additive — adds calories without nutrition',
  'corn syrup': 'Liquid sugar linked to weight gain and insulin spikes',
  'artificial flavor': 'Chemical flavoring with no nutritional value',
  'artificial colour': 'Synthetic dyes linked to hyperactivity in children',
  'artificial color': 'Synthetic dyes linked to hyperactivity in children',
  'monosodium glutamate': 'MSG may cause headaches or sensitivity in some people',
  'hydrogenated': 'Contains hydrogenated fats — bad for heart health',
  'dehydrated potato': 'Highly processed potato base — low fiber, high carbs',
  'corn flour': 'Refined starch in snacks — quick blood sugar spike',
  'potato starch': 'Processed starch with minimal fiber or protein',
  'emulsifier': 'Processed additive — indicates highly manufactured food',
  'flavor enhancer': 'Chemical additive to boost taste — often MSG-based',
};

const JUNK_FOOD_KEYWORDS = [
  'chip', 'crisp', 'candy', 'chocolate', 'soda', 'cola', 'pepsi', 'instant noodle',
  'cookie', 'biscuit', 'wafer', 'nacho', 'popcorn', 'fry', 'snack', 'lays',
  'kurkure', 'cheetos', 'doritos', 'pringles', 'maggie', 'ramen', 'burger',
  'pizza', 'donut', 'cake', 'ice cream', 'soft drink', 'energy drink',
];

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

const EGG_MARKERS = ['egg', 'eggs', 'albumin', 'ovalbumin', 'mayonnaise', 'mayo'];
const MEAT_MARKERS = ['chicken', 'beef', 'pork', 'mutton', 'lamb', 'meat', 'bacon', 'ham', 'lard', 'gelatin', 'sausage', 'pepperoni', 'turkey', 'duck'];
const FISH_MARKERS = ['fish', 'shrimp', 'prawn', 'crab', 'seafood', 'anchovy', 'tuna', 'salmon', 'shellfish', 'oyster', 'squid'];

export function checkDietAlerts(
  name: string,
  ingredients: string[],
  profile: UserProfile,
): DietAlert[] {
  if (profile.dietType !== 'vegetarian') return [];

  const text = `${name} ${ingredients.join(' ')}`.toLowerCase();
  const alerts: DietAlert[] = [];

  if (EGG_MARKERS.some((m) => text.includes(m))) {
    alerts.push({
      type: 'egg',
      label: 'Contains EGG',
      emoji: '🥚',
      message: 'This food contains egg. Are you okay eating it?',
    });
  }
  if (MEAT_MARKERS.some((m) => text.includes(m))) {
    alerts.push({
      type: 'meat',
      label: 'Contains MEAT',
      emoji: '🍖',
      message: 'This is NOT vegetarian — it contains meat.',
    });
  }
  if (FISH_MARKERS.some((m) => text.includes(m))) {
    alerts.push({
      type: 'fish',
      label: 'Contains FISH',
      emoji: '🐟',
      message: 'This is NOT vegetarian — it contains fish or seafood.',
    });
  }
  return alerts;
}

function buildHighlightTags(analysis: Partial<FoodAnalysis>): string[] {
  const tags: string[] = [];
  if (analysis.isJunkFood) tags.push('🍟 Junk food');
  if (analysis.dietAlerts?.length) tags.push('⚠️ Not veg-friendly');
  if (analysis.allergens?.length) tags.push('🚫 Allergen');
  if (analysis.harmfulAdditives?.length || (analysis.healthConcerns?.length ?? 0) > 0) tags.push('⚗️ Additives');
  if (analysis.facts && analysis.facts.fat >= 20) tags.push('🔴 High fat');
  if (analysis.facts && analysis.facts.calories >= 400) tags.push('🔥 High calorie');
  return tags.slice(0, 4);
}

function buildQuickSummary(analysis: FoodAnalysis, profile: UserProfile): string {
  if (analysis.dietAlerts?.length) {
    return analysis.dietAlerts.map((a) => a.message).join(' ');
  }
  if (analysis.verdict === 'great' || analysis.verdict === 'good') {
    return 'Looks good for your plan — enjoy in a sensible portion.';
  }
  if (analysis.isJunkFood) {
    return analysis.portionAdvice?.split('—')[0] || 'Processed snack — keep it occasional.';
  }
  if (analysis.verdict === 'poor') {
    return 'Best to skip or eat a very small portion today.';
  }
  return 'Okay in moderation — balance with lighter meals later.';
}

function applyPresentationLayer(
  analysis: FoodAnalysis,
  profile: UserProfile,
): FoodAnalysis {
  analysis.dietAlerts = checkDietAlerts(analysis.name, analysis.ingredients || [], profile);
  if (analysis.dietAlerts.length > 0) {
    analysis.verdict = 'poor';
    analysis.warnings = [
      ...analysis.dietAlerts.map((a) => a.message),
      ...analysis.warnings.filter((w) => !analysis.dietAlerts!.some((d) => w.includes(d.label))),
    ];
  }
  if (analysis.whyLimit && analysis.whyLimit.length > 2) {
    analysis.whyLimit = analysis.whyLimit.slice(0, 2);
  }
  if (analysis.healthConcerns && analysis.healthConcerns.length > 3) {
    analysis.healthConcerns = analysis.healthConcerns.slice(0, 3);
  }
  analysis.highlightTags = buildHighlightTags(analysis);
  analysis.quickSummary = buildQuickSummary(analysis, profile);
  return analysis;
}

export function checkProcessedIngredients(ingredients: string[]): string[] {
  const found: string[] = [];
  const lower = ingredients.map((i) => i.toLowerCase());
  for (const [key, label] of Object.entries(PROCESSED_INGREDIENTS)) {
    if (lower.some((i) => i.includes(key))) {
      found.push(label);
    }
  }
  return found;
}

function detectJunkFood(
  name: string,
  ingredients: string[],
  facts: NutritionFacts,
  categories?: string,
): boolean {
  const text = `${name} ${categories || ''} ${ingredients.join(' ')}`.toLowerCase();
  const byKeyword = JUNK_FOOD_KEYWORDS.some((k) => text.includes(k));
  const byNutrition = facts.calories >= 350 && facts.fat >= 20;
  const byProcessing = ingredients.length >= 3 && facts.fiber < 5 && facts.protein < 10;
  return byKeyword || byNutrition || byProcessing;
}

function getPortionAdvice(
  facts: NutritionFacts,
  targets: NutritionTargets,
  isJunk: boolean,
  servingLabel?: string,
): string {
  if (facts.calories <= 0) return '';
  const serving = servingLabel || 'per pack/serving';
  const snackBudget = targets.calories * (isJunk ? 0.12 : 0.2);
  let maxPacks = Math.floor(snackBudget / facts.calories);
  if (isJunk) maxPacks = Math.min(maxPacks, 2);
  maxPacks = Math.max(1, maxPacks);

  if (isJunk && facts.calories >= 400) {
    return `Limit to 1 serving (${facts.calories} kcal ${serving}) — high-calorie junk snack. Two packs = ${facts.calories * 2} kcal (${Math.round((facts.calories * 2 / targets.calories) * 100)}% of daily budget).`;
  }
  if (isJunk && maxPacks === 1) {
    return `Stick to 1 pack (${facts.calories} kcal ${serving}) per day — more adds excess fat with little nutrition.`;
  }
  if (isJunk) {
    return `Up to ${maxPacks} packs (${facts.calories * maxPacks} kcal ${serving}) — don't exceed to stay on track.`;
  }
  return `${facts.calories} kcal ${serving} — uses ${Math.round((facts.calories / targets.calories) * 100)}% of your daily calories.`;
}

export function analyzePackagedFood(
  name: string,
  facts: NutritionFacts,
  profile: UserProfile,
  ingredients: string[] = [],
  options?: { categories?: string; servingLabel?: string },
): FoodAnalysis {
  const base = analyzeFood(name, facts, profile, ingredients);
  const processedConcerns = checkProcessedIngredients(ingredients);
  const isJunk = detectJunkFood(name, ingredients, facts, options?.categories);
  const healthConcerns: string[] = [...base.harmfulAdditives, ...processedConcerns];
  const whyLimit: string[] = [];
  const warnings = [...base.warnings];
  const targets = calculateTargets(profile);

  if (isJunk) {
    base.junkFoodLabel = 'Processed / Junk Food';
    base.isJunkFood = true;
    whyLimit.push('High calories but low protein, fiber, and nutrients — "empty calories".');
    if (facts.fat >= 20) {
      whyLimit.push(`${facts.fat}g fat per serving — frying/oils increase heart disease risk over time.`);
      warnings.push(`High fat (${facts.fat}g per serving) — typical of fried/processed snacks`);
    }
    if (facts.sodium >= 300) {
      whyLimit.push(`${facts.sodium}mg sodium — excess salt strains kidneys and raises blood pressure.`);
    } else if (facts.sodium === 0) {
      whyLimit.push('Packaged snacks are usually high in salt — check the label for sodium.');
    }
    if (facts.calories >= 400) {
      whyLimit.push(`${facts.calories} kcal per serving — multiple packs quickly exceed your daily budget.`);
      warnings.push(`Very high calories (${facts.calories} kcal per serving) — limit portions`);
    }
    if (facts.sugar >= 10) {
      whyLimit.push(`${facts.sugar}g sugar — spikes blood sugar and promotes weight gain.`);
    }
    if (processedConcerns.length > 0) {
      whyLimit.push('Contains processed oils, starches, or additives — not whole food.');
    }
    if (ingredients.length >= 5) {
      whyLimit.push(`${ingredients.length}+ ingredients — long lists mean highly processed food.`);
    }
    base.verdict = facts.calories >= 450 || facts.fat >= 25 ? 'poor' : 'moderate';
    if (base.allergens.length > 0 || base.harmfulAdditives.length > 0) {
      base.verdict = 'poor';
    }
    base.emoji = '🍟';
    base.recommendation = 'Occasional treat only — choose fruit, nuts, or homemade snacks on most days.';
  }

  if (facts.fat >= 15 && !isJunk) {
    healthConcerns.push('Moderate fat — balance with lighter meals today.');
  }
  if (facts.sodium >= 400) {
    healthConcerns.push(`High sodium (${facts.sodium}mg) — limit if you have hypertension.`);
  }

  base.healthConcerns = healthConcerns;
  base.whyLimit = whyLimit;
  base.portionAdvice = getPortionAdvice(facts, targets, isJunk, options?.servingLabel);
  base.servingLabel = options?.servingLabel;
  base.warnings = warnings;

  if (base.portionAdvice && isJunk) {
    base.recommendation = `${base.portionAdvice} ${base.recommendation || ''}`.trim();
  }

  return applyPresentationLayer(base, profile);
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
    if (cond === 'pcos' && facts.sugar > 8) {
      warnings.push(`High sugar (${facts.sugar}g) — risky for PCOS`);
    }
    if (cond === 'pcos' && facts.carbs > 40) {
      warnings.push(`High carbs (${facts.carbs}g) — may affect insulin with PCOS`);
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

  return applyPresentationLayer({
    name,
    emoji: '🍽️',
    facts,
    verdict,
    warnings,
    allergens,
    harmfulAdditives,
    ingredients,
    recommendation,
  }, profile);
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
  ingredients?: string[];
  feedback?: MealFeedback;
}

export type FeedbackSymptom =
  | 'none'
  | 'nausea'
  | 'vomiting'
  | 'rash'
  | 'itching'
  | 'stomach_pain'
  | 'diarrhea'
  | 'headache'
  | 'bloating'
  | 'breathing_difficulty';

export interface MealFeedback {
  symptoms: FeedbackSymptom[];
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  notes?: string;
  submittedAt: string;
  suspectedAllergy?: boolean;
  suspectedFoodPoisoning?: boolean;
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

const SYMPTOM_ALLERGY_MAP: Record<FeedbackSymptom, boolean> = {
  none: false,
  nausea: false,
  vomiting: true,
  rash: true,
  itching: true,
  stomach_pain: false,
  diarrhea: true,
  headache: false,
  bloating: false,
  breathing_difficulty: true,
};

export function analyzeFeedbackSymptoms(symptoms: FeedbackSymptom[]): {
  suspectedAllergy: boolean;
  suspectedFoodPoisoning: boolean;
  message: string;
} {
  if (!symptoms.length || symptoms.every((s) => s === 'none')) {
    return { suspectedAllergy: false, suspectedFoodPoisoning: false, message: 'No issues reported.' };
  }
  const allergySymptoms = symptoms.filter((s) => SYMPTOM_ALLERGY_MAP[s]);
  const poisoningSymptoms = symptoms.filter((s) =>
    ['vomiting', 'diarrhea', 'stomach_pain', 'nausea'].includes(s),
  );
  const suspectedAllergy = allergySymptoms.length >= 1 && symptoms.includes('rash') || symptoms.includes('itching') || symptoms.includes('breathing_difficulty');
  const suspectedFoodPoisoning = poisoningSymptoms.length >= 2 || (symptoms.includes('vomiting') && symptoms.includes('diarrhea'));

  let message = '';
  if (suspectedAllergy) message = 'Possible allergic reaction — avoid this food and similar ingredients.';
  else if (suspectedFoodPoisoning) message = 'Possible food poisoning symptoms — drink water and seek medical help if severe.';
  else if (symptoms.length > 0) message = 'Mild discomfort noted — monitor and log again if it persists.';

  return { suspectedAllergy, suspectedFoodPoisoning, message };
}

export function getDailyRecommendations(
  consumed: NutritionFacts,
  targets: NutritionTargets,
  profile: UserProfile,
  hour: number = new Date().getHours(),
): string[] {
  const recs: string[] = [];
  const remCal = targets.calories - consumed.calories;
  const remProtein = targets.protein - consumed.protein;
  const remFiber = targets.fiber - consumed.fiber;

  if (remProtein > 15) {
    const isVeg = profile.dietType === 'vegetarian';
    if (isVeg) {
      recs.push(`Need ${Math.round(remProtein)}g protein — try dal, paneer, or chole.`);
    } else {
      recs.push(`Need ${Math.round(remProtein)}g protein — try dal, paneer, or grilled chicken.`);
    }
  }
  if (remFiber > 5) {
    recs.push(`Need ${Math.round(remFiber)}g more fiber — add salad, chole, or rajma to your next meal.`);
  }
  if (remCal > 400 && hour < 20) {
    if (profile.dietType === 'vegetarian') {
      recs.push(`${Math.round(remCal)} kcal left — a veg thali or dal-rice fits your budget.`);
    } else {
      recs.push(`${Math.round(remCal)} kcal left — a thali or biryani fits your remaining budget.`);
    }
  } else if (remCal < -200) {
    recs.push(`You're ${Math.abs(Math.round(remCal))} kcal over — choose a light salad or soup for your next meal.`);
  }
  if (profile.medicalConditions.includes('diabetes') && consumed.sugar > targets.sugarMax * 0.6) {
    recs.push('Sugar budget running high — prefer idli, dal, or vegetable curry for dinner.');
  }
  if (profile.medicalConditions.includes('hypertension') && consumed.sodium > targets.sodiumMax * 0.7) {
    recs.push('Sodium is high today — avoid packaged snacks and salty curries.');
  }
  if (hour >= 11 && hour < 15 && consumed.calories < targets.calories * 0.25) {
    recs.push('Lunch window — log a meal now to avoid long gaps and overeating later.');
  }
  if (recs.length === 0) {
    recs.push('Great balance so far — keep logging meals to stay on track!');
  }
  return recs;
}
