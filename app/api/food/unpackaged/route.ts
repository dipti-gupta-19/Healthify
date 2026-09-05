import { NextResponse } from 'next/server';
import {
  analyzeFood,
  calculateTargets,
  checkBeneficialIngredients,
  type NutritionFacts,
  type UserProfile,
  type FoodAnalysis,
} from '@/lib/nutrition';
import { analyzeFoodFromImage, analyzeDishByName } from '@/lib/vision';
import { hasGeminiKey, getGeminiKeyHint } from '@/lib/gemini';

function applyHighFlags(
  analysis: FoodAnalysis,
  flags: string[],
  targets: ReturnType<typeof calculateTargets>,
) {
  for (const flag of flags) {
    const lower = flag.toLowerCase();
    if (lower.includes('sugar') && !analysis.warnings.some((w) => w.includes('sugar'))) {
      analysis.warnings.push(`High sugar — ${analysis.facts.sugar}g in this portion`);
    }
    if (lower.includes('fat') && !analysis.warnings.some((w) => w.includes('fat'))) {
      analysis.warnings.push(`High fat — ${analysis.facts.fat}g in this portion`);
    }
    if (lower.includes('sodium') && !analysis.warnings.some((w) => w.includes('sodium'))) {
      analysis.warnings.push(`High sodium — ${analysis.facts.sodium}mg in this portion`);
    }
    if (lower.includes('calorie') && !analysis.warnings.some((w) => w.includes('calorie'))) {
      analysis.warnings.push(
        `High calories — ${analysis.facts.calories} kcal (${Math.round((analysis.facts.calories / targets.calories) * 100)}% of daily budget)`,
      );
    }
    if (lower.includes('carb') && !analysis.warnings.some((w) => w.includes('carb'))) {
      analysis.warnings.push(`High carbs — ${analysis.facts.carbs}g in this portion`);
    }
  }
  if (!analysis.highlightTags) analysis.highlightTags = [];
  for (const flag of flags.slice(0, 3)) {
    const tag = `⚠️ ${flag}`;
    if (!analysis.highlightTags.includes(tag)) analysis.highlightTags.push(tag);
  }
}

function applyDailyBudgetWarnings(
  analysis: FoodAnalysis,
  targets: ReturnType<typeof calculateTargets>,
) {
  const calPct = Math.round((analysis.facts.calories / targets.calories) * 100);
  const fatPct = Math.round((analysis.facts.fat / targets.fat) * 100);

  if (calPct >= 40) {
    analysis.warnings.push(`Uses ${calPct}% of your daily calorie budget (${analysis.facts.calories}/${targets.calories} kcal)`);
    if (!analysis.highlightTags) analysis.highlightTags = [];
    if (!analysis.highlightTags.includes('🔥 Budget impact')) {
      analysis.highlightTags.unshift('🔥 Budget impact');
    }
  }
  if (fatPct >= 40) {
    analysis.warnings.push(`Uses ${fatPct}% of your daily fat limit (${analysis.facts.fat}g/${targets.fat}g)`);
  }
  if (analysis.allergens.length > 0) {
    analysis.warnings.unshift(`⚠️ ALLERGEN: contains ${analysis.allergens.join(', ')} — matches your profile allergies`);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { foodName, profile, imageBase64, mimeType } = body as {
      foodName?: string;
      profile: UserProfile;
      imageBase64?: string;
      mimeType?: string;
    };

    if (!profile) {
      return NextResponse.json({ error: 'Profile is required' }, { status: 400 });
    }

    if (!imageBase64 && !foodName?.trim()) {
      return NextResponse.json({ error: 'Upload a food photo — AI will identify the dish automatically.' }, { status: 400 });
    }

    let resolvedName = '';
    let identifiedBy: string | null = null;
    let ingredients: string[] = [];
    let facts: NutritionFacts | null = null;
    let emoji = '🍽️';
    let detectedItems: string[] = [];
    let portionDescription = '';
    let highFlags: string[] = [];
    let cuisine = '';
    let cookingMethods: string[] = [];
    let benefits: string[] = [];
    let apiError: string | undefined;

    if (imageBase64) {
      const { result, error } = await analyzeFoodFromImage(imageBase64, mimeType || 'image/jpeg');
      apiError = error;
      if (result) {
        resolvedName = result.name;
        ingredients = result.ingredients;
        facts = result.facts;
        emoji = result.emoji;
        identifiedBy = 'ai';
        detectedItems = result.detectedItems || [];
        portionDescription = result.portionDescription || '';
        highFlags = result.highFlags || [];
        cuisine = result.cuisine || '';
        cookingMethods = result.cookingMethods || [];
        benefits = result.benefits || [];
      }
    }

    if (!facts && foodName?.trim()) {
      const aiResult = await analyzeDishByName(foodName.trim());
      if (aiResult) {
        resolvedName = aiResult.name;
        facts = aiResult.facts;
        emoji = aiResult.emoji;
        ingredients = aiResult.ingredients;
        detectedItems = aiResult.detectedItems || [];
        portionDescription = aiResult.portionDescription || '';
        highFlags = aiResult.highFlags || [];
        cuisine = aiResult.cuisine || '';
        cookingMethods = aiResult.cookingMethods || [];
        benefits = aiResult.benefits || [];
        identifiedBy = 'ai';
      }
    }

    if (!facts) {
      const hint = getGeminiKeyHint();
      return NextResponse.json({
        error: imageBase64
          ? apiError || hint || 'Could not analyze photo. Ensure GEMINI_API_KEY is in .env and restart the server.'
          : hint || 'Could not identify dish.',
      }, { status: 400 });
    }

    const analysis = analyzeFood(resolvedName, facts, profile, ingredients);
    analysis.emoji = emoji;
    analysis.ingredients = ingredients.length > 0 ? ingredients : analysis.ingredients;
    analysis.detectedItems = detectedItems.length > 0 ? detectedItems : undefined;
    analysis.portionDescription = portionDescription || undefined;
    analysis.servingLabel = portionDescription || analysis.servingLabel;
    analysis.cuisine = cuisine || undefined;
    analysis.cookingMethods = cookingMethods.length > 0 ? cookingMethods : undefined;
    analysis.benefits = benefits.length > 0 ? benefits : undefined;
    analysis.beneficialAspects = [
      ...benefits,
      ...checkBeneficialIngredients(ingredients),
    ].slice(0, 8);

    const targets = calculateTargets(profile);
    if (highFlags.length > 0) applyHighFlags(analysis, highFlags, targets);

    const autoFlags: string[] = [];
    if (analysis.facts.calories > targets.calories * 0.35) autoFlags.push('high calories');
    if (analysis.facts.sugar > targets.sugarMax * 0.4) autoFlags.push('high sugar');
    if (analysis.facts.fat > targets.fat * 0.4) autoFlags.push('high fat');
    if (analysis.facts.sodium > targets.sodiumMax * 0.35) autoFlags.push('high sodium');
    if (autoFlags.length) applyHighFlags(analysis, autoFlags, targets);

    applyDailyBudgetWarnings(analysis, targets);

    if (identifiedBy === 'ai') {
      const methodNote = cookingMethods.length ? ` Cooked: ${cookingMethods.join(', ')}.` : '';
      const sourceLabel = imageBase64 ? 'from your photo' : 'from your meal description';
      const portionNote = portionDescription ? ` Portion: ${portionDescription}.` : ' Nutrition calculated for your portion.';
      analysis.recommendation = `AI analyzed ${sourceLabel}: "${resolvedName}"${cuisine ? ` (${cuisine})` : ''}.${methodNote}${portionNote}`;
      if (analysis.verdict === 'great' || analysis.verdict === 'good') {
        analysis.quickSummary = analysis.quickSummary || 'Good fit for your plan — enjoy this portion.';
      } else if (analysis.verdict === 'poor') {
        analysis.quickSummary = 'Best to avoid or eat a very small portion — high impact on your daily budget.';
      }
    }

    return NextResponse.json({
      analysis,
      identifiedName: resolvedName,
      identifiedBy,
      detectedItems,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
  }
}
