import { NextResponse } from 'next/server';
import {
  analyzePackagedFood,
  checkBeneficialIngredients,
  type NutritionFacts,
  type UserProfile,
} from '@/lib/nutrition';
import { analyzeLabelFromImage, analyzePackagedIngredients } from '@/lib/vision';
import { extractProductNameFromLabel } from '@/lib/food-db';

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  generic_name?: string;
  categories?: string;
  ingredients_text?: string;
  ingredients?: { text: string }[];
  nutriments?: {
    'energy-kcal_100g'?: number;
    'energy-kcal'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    salt_100g?: number;
    sodium_100g?: number;
  };
  serving_size?: string;
  serving_quantity?: number;
}

function parseIngredients(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[,;()]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^\d+$/.test(s));
}

const INGREDIENT_NUTRITION: Record<string, Partial<NutritionFacts>> = {
  sugar: { calories: 387, carbs: 100, sugar: 100 },
  'high fructose corn syrup': { calories: 281, carbs: 76, sugar: 76 },
  'wheat flour': { calories: 364, carbs: 76, protein: 12, fiber: 2.5 },
  'palm oil': { calories: 884, fat: 100 },
  'sunflower oil': { calories: 884, fat: 100 },
  'soybean oil': { calories: 884, fat: 100 },
  'cocoa powder': { calories: 228, carbs: 58, fat: 14, fiber: 33, protein: 20 },
  'milk powder': { calories: 496, protein: 26, carbs: 39, fat: 26 },
  'milk': { calories: 42, protein: 3.4, carbs: 5, fat: 1 },
  'butter': { calories: 717, fat: 81 },
  'cheese': { calories: 402, protein: 25, fat: 33 },
  'egg': { calories: 143, protein: 13, fat: 10 },
  'salt': { sodium: 38800 },
  'sodium bicarbonate': { sodium: 27360 },
  'soy lecithin': { calories: 763, fat: 80 },
  'corn syrup': { calories: 281, carbs: 76, sugar: 76 },
  'honey': { calories: 304, carbs: 82, sugar: 82 },
  'oats': { calories: 389, carbs: 66, protein: 17, fiber: 10, fat: 7 },
  'rice': { calories: 130, carbs: 28, protein: 2.7 },
  'chicken': { calories: 165, protein: 31, fat: 3.6 },
  'beef': { calories: 250, protein: 26, fat: 17 },
  'tomato': { calories: 18, carbs: 3.9, fiber: 1.2, sugar: 2.6 },
  'onion': { calories: 40, carbs: 9, fiber: 1.7, sugar: 4.2 },
  'garlic': { calories: 149, carbs: 33, protein: 6.4, fiber: 2.1 },
  'potato': { calories: 77, carbs: 17, fiber: 2.2, protein: 2 },
  'soy': { calories: 446, protein: 36, fat: 20, carbs: 30, fiber: 9 },
  'wheat': { calories: 340, carbs: 72, protein: 13, fiber: 10 },
  'corn': { calories: 86, carbs: 19, protein: 3.2, fiber: 2.7, sugar: 3.2 },
  'peanut': { calories: 567, protein: 26, fat: 49, carbs: 16, fiber: 8 },
  'almond': { calories: 579, protein: 21, fat: 50, carbs: 22, fiber: 12 },
  'coconut': { calories: 354, fat: 33, carbs: 15, fiber: 9 },
  'cocoa': { calories: 228, carbs: 58, fat: 14, fiber: 33, protein: 20 },
  'vanillin': { calories: 288, carbs: 63 },
  'dehydrated potatoes': { calories: 77, carbs: 17, fiber: 2.2, protein: 2 },
  'vegetable oil': { calories: 884, fat: 100 },
};

function estimateFromIngredients(ingredients: string[]): NutritionFacts {
  const lower = ingredients.map((i) => i.toLowerCase());
  const totals: NutritionFacts = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  let matched = 0;

  for (const ing of lower) {
    for (const [key, vals] of Object.entries(INGREDIENT_NUTRITION)) {
      if (ing.includes(key)) {
        matched++;
        for (const [k, v] of Object.entries(vals)) {
          const key2 = k as keyof NutritionFacts;
          totals[key2] = totals[key2] + (v as number);
        }
        break;
      }
    }
  }

  if (matched === 0) {
    return { calories: 250, protein: 5, carbs: 30, fat: 12, fiber: 2, sugar: 8, sodium: 300 };
  }

  const scale = 100 / Math.max(matched * 30, 100);
  return {
    calories: Math.round(totals.calories * scale),
    protein: Math.round(totals.protein * scale * 10) / 10,
    carbs: Math.round(totals.carbs * scale * 10) / 10,
    fat: Math.round(totals.fat * scale * 10) / 10,
    fiber: Math.round(totals.fiber * scale * 10) / 10,
    sugar: Math.round(totals.sugar * scale * 10) / 10,
    sodium: Math.round(totals.sodium * scale),
  };
}

function isProductFound(data: { status?: number | string; product?: OFFProduct }): boolean {
  return data.product != null && (data.status === 1 || data.status === 'success');
}

function buildProductName(p: OFFProduct): string {
  const name = p.product_name_en || p.product_name || p.generic_name || '';
  const brand = p.brands?.split(',')[0]?.trim();
  const isLatin = (s: string) => /^[\x00-\x7F\u00C0-\u024F]+$/.test(s.replace(/[^a-zA-Z\s'-]/g, ''));

  if (name && isLatin(name.replace(/[^a-zA-Z\s'-]/g, '')) && name.replace(/[^a-zA-Z]/g, '').length > 2) {
    if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
      return `${brand} ${name}`;
    }
    return name;
  }

  if (brand && p.generic_name) return `${brand} ${p.generic_name}`;
  if (brand && p.categories) {
    const cat = p.categories.split(',')[0]?.trim();
    if (cat) return `${brand} ${cat}`;
  }
  if (brand) return brand;
  return name || 'Unknown Product';
}

function extractNutrition(p: OFFProduct): NutritionFacts {
  const n = p.nutriments || {};
  const serving = p.serving_quantity || 100;
  const scale = serving / 100;
  const sodiumPer100g = n.sodium_100g || (n.salt_100g ? n.salt_100g * 400 : 0);
  const caloriesPer100g = n['energy-kcal_100g'] || n['energy-kcal'] || 0;

  return {
    calories: Math.round(caloriesPer100g * scale),
    protein: Math.round((n.proteins_100g || 0) * scale * 10) / 10,
    carbs: Math.round((n.carbohydrates_100g || 0) * scale * 10) / 10,
    fat: Math.round((n.fat_100g || 0) * scale * 10) / 10,
    fiber: Math.round((n.fiber_100g || 0) * scale * 10) / 10,
    sugar: Math.round((n.sugars_100g || 0) * scale * 10) / 10,
    sodium: Math.round(sodiumPer100g * scale),
  };
}

function buildServingLabel(p: OFFProduct): string {
  if (p.serving_size) return p.serving_size;
  if (p.serving_quantity) return `${p.serving_quantity}g per serving`;
  return 'per 100g';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { barcode, ingredientText, profile, imageBase64, mimeType } = body as {
      barcode?: string;
      ingredientText?: string;
      profile: UserProfile;
      imageBase64?: string;
      mimeType?: string;
    };

    if (!profile) {
      return NextResponse.json({ error: 'Profile is required' }, { status: 400 });
    }

    let facts: NutritionFacts;
    let foodName: string;
    let ingredients: string[] = [];
    let categories: string | undefined;
    let servingLabel: string | undefined;
    let extraHarmful: string[] = [];
    let extraBeneficial: string[] = [];

    if (barcode) {
      const cleanBarcode = barcode.trim().replace(/\D/g, '');
      let p: OFFProduct | null = null;

      const v2Res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}?fields=product_name,product_name_en,brands,generic_name,categories,ingredients_text,ingredients,nutriments,serving_size,serving_quantity`,
        { headers: { 'User-Agent': 'Healthify/1.0' } },
      );
      if (v2Res.ok) {
        const data = await v2Res.json();
        if (isProductFound(data)) {
          p = data.product as OFFProduct;
        }
      }

      if (!p) {
        const v0Res = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${cleanBarcode}.json`,
          { headers: { 'User-Agent': 'Healthify/1.0' } },
        );
        if (v0Res.ok) {
          const data = await v0Res.json();
          if (data.status === 1 && data.product) {
            p = data.product as OFFProduct;
          }
        }
      }

      if (!p) {
        return NextResponse.json({
          error: 'Product not found in database. Try scanning the ingredient label instead.',
        }, { status: 404 });
      }

      foodName = buildProductName(p);
      facts = extractNutrition(p);
      categories = p.categories;
      servingLabel = buildServingLabel(p);
      ingredients = parseIngredients(p.ingredients_text || '');
      if (ingredients.length === 0 && p.ingredients) {
        ingredients = p.ingredients.map((i) => i.text);
      }
    } else if (ingredientText || imageBase64) {
      let text = ingredientText || '';
      let productName: string | null = null;

      if (imageBase64) {
        const labelResult = await analyzeLabelFromImage(imageBase64, mimeType || 'image/jpeg');
        if (labelResult) {
          productName = labelResult.productName;
          text = labelResult.ingredientsText || labelResult.ingredients.join(', ');
          ingredients = labelResult.ingredients;
        }
      }

      if (!text && imageBase64) {
        return NextResponse.json({
          error: 'Could not read label from image. Try pasting ingredients manually.',
        }, { status: 400 });
      }

      if (!productName) {
        productName = extractProductNameFromLabel(text);
      }

      foodName = productName || 'Packaged Food';

      if (!ingredients.length) {
        ingredients = parseIngredients(text);
      }

      facts = estimateFromIngredients(ingredients);

      const aiIngredientAnalysis = await analyzePackagedIngredients(foodName, ingredients);
      if (aiIngredientAnalysis) {
        extraHarmful = aiIngredientAnalysis.harmful;
        extraBeneficial = aiIngredientAnalysis.beneficial;
        if (aiIngredientAnalysis.facts && aiIngredientAnalysis.facts.calories > 0) {
          facts = aiIngredientAnalysis.facts;
        }
      }
    } else {
      return NextResponse.json({
        error: 'barcode, ingredientText, or imageBase64 required',
      }, { status: 400 });
    }

    const analysis = analyzePackagedFood(foodName, facts, profile, ingredients, {
      categories,
      servingLabel,
    });

    if (extraHarmful.length) {
      analysis.harmfulAdditives = [...new Set([...analysis.harmfulAdditives, ...extraHarmful])];
      analysis.healthConcerns = [...new Set([...(analysis.healthConcerns || []), ...extraHarmful])];
    }
    if (extraBeneficial.length) {
      analysis.beneficialAspects = [...new Set([
        ...(analysis.beneficialAspects || []),
        ...extraBeneficial,
        ...checkBeneficialIngredients(ingredients),
      ])].slice(0, 8);
    }

    return NextResponse.json({ analysis, productName: foodName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
  }
}
