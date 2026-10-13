import { NextResponse } from 'next/server';
import {
  analyzePackagedFood,
  checkBeneficialIngredients,
  type NutritionFacts,
  type UserProfile,
} from '@/lib/nutrition';
import {
  analyzeLabelFromImage,
  analyzePackagedIngredients,
  analyzeBarcodeWithAI,
  analyzePackagedProductByName,
} from '@/lib/vision';
import { extractProductNameFromLabel } from '@/lib/food-db';

interface OFFProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  generic_name?: string;
  categories?: string;
  ingredients_text?: string;
  ingredients?: { text: string }[];
  nutriments?: Record<string, any>;
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
  milk: { calories: 42, protein: 3.4, carbs: 5, fat: 1 },
  butter: { calories: 717, fat: 81 },
  cheese: { calories: 402, protein: 25, fat: 33 },
  egg: { calories: 143, protein: 13, fat: 10 },
  salt: { sodium: 38800 },
  'sodium bicarbonate': { sodium: 27360 },
  'soy lecithin': { calories: 763, fat: 80 },
  'corn syrup': { calories: 281, carbs: 76, sugar: 76 },
  honey: { calories: 304, carbs: 82, sugar: 82 },
  oats: { calories: 389, carbs: 66, protein: 17, fiber: 10, fat: 7 },
  rice: { calories: 130, carbs: 28, protein: 2.7 },
  chicken: { calories: 165, protein: 31, fat: 3.6 },
  beef: { calories: 250, protein: 26, fat: 17 },
  tomato: { calories: 18, carbs: 3.9, fiber: 1.2, sugar: 2.6 },
  onion: { calories: 40, carbs: 9, fiber: 1.7, sugar: 4.2 },
  garlic: { calories: 149, carbs: 33, protein: 6.4, fiber: 2.1 },
  potato: { calories: 77, carbs: 17, fiber: 2.2, protein: 2 },
  soy: { calories: 446, protein: 36, fat: 20, carbs: 30, fiber: 9 },
  wheat: { calories: 340, carbs: 72, protein: 13, fiber: 10 },
  corn: { calories: 86, carbs: 19, protein: 3.2, fiber: 2.7, sugar: 3.2 },
  peanut: { calories: 567, protein: 26, fat: 49, carbs: 16, fiber: 8 },
  almond: { calories: 579, protein: 21, fat: 50, carbs: 22, fiber: 12 },
  coconut: { calories: 354, fat: 33, carbs: 15, fiber: 9 },
  cocoa: { calories: 228, carbs: 58, fat: 14, fiber: 33, protein: 20 },
  vanillin: { calories: 288, carbs: 63 },
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
  const name = (p.product_name_en || p.product_name || p.generic_name || '').trim();
  const brand = p.brands?.split(',')[0]?.trim();
  const isLatin = (s: string) => /^[\x00-\x7F\u00C0-\u024F]+$/.test(s.replace(/[^a-zA-Z\s'-]/g, ''));

  if (name && isLatin(name.replace(/[^a-zA-Z\s'-]/g, '')) && name.replace(/[^a-zA-Z]/g, '').length > 2) {
    if (brand) {
      const cleanBrand = brand.toLowerCase().replace(/[^a-z]/g, '');
      const cleanName = name.toLowerCase().replace(/[^a-z]/g, '');
      if (!cleanName.includes(cleanBrand)) {
        return `${brand} ${name}`;
      }
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

  let rawSodium = n.sodium_100g ?? (n.sodium as number | undefined);
  let sodiumMg = 0;
  if (typeof rawSodium === 'number' && rawSodium > 0) {
    sodiumMg = rawSodium < 10 ? Math.round(rawSodium * 1000) : Math.round(rawSodium);
  } else if (typeof n.salt_100g === 'number' && n.salt_100g > 0) {
    sodiumMg = Math.round(n.salt_100g * 400);
  } else if (typeof n.salt === 'number' && n.salt > 0) {
    sodiumMg = Math.round(n.salt * 400);
  }

  const caloriesPer100g = n['energy-kcal_100g'] || n['energy-kcal'] || 0;
  const proteinsPer100g = n.proteins_100g || (n.proteins as number) || 0;
  const carbsPer100g = n.carbohydrates_100g || (n.carbohydrates as number) || 0;
  const fatPer100g = n.fat_100g || (n.fat as number) || 0;
  const fiberPer100g = n.fiber_100g || (n.fiber as number) || 0;
  const sugarsPer100g = n.sugars_100g || (n.sugars as number) || 0;

  return {
    calories: Math.round(caloriesPer100g * scale),
    protein: Math.round(proteinsPer100g * scale * 10) / 10,
    carbs: Math.round(carbsPer100g * scale * 10) / 10,
    fat: Math.round(fatPer100g * scale * 10) / 10,
    fiber: Math.round(fiberPer100g * scale * 10) / 10,
    sugar: Math.round(sugarsPer100g * scale * 10) / 10,
    sodium: Math.round(sodiumMg * scale),
  };
}

function buildServingLabel(p: OFFProduct): string {
  if (p.serving_size) return p.serving_size;
  if (p.serving_quantity) return `${p.serving_quantity}g per serving`;
  return 'per 100g';
}

async function fetchFromUPCItemDB(barcode: string): Promise<OFFProduct | null> {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
      headers: { 'User-Agent': 'HealthifyApp/2.0' },
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return {
          product_name: item.title,
          brands: item.brand,
          categories: item.category,
        };
      }
    }
  } catch {}
  return null;
}

async function fetchFromOFF(barcodeCode: string): Promise<OFFProduct | null> {
  const clean = barcodeCode.replace(/\D/g, '');
  if (!clean || clean.length < 6) return null;

  const variations = [clean];
  if (clean.length === 12) variations.push(`0${clean}`);
  if (clean.length === 13 && clean.startsWith('0')) variations.push(clean.slice(1));
  const uniqueVars = [...new Set(variations)];

  const headers = { 'User-Agent': 'HealthifyNutrition/2.0 (healthify.app; contact@healthify.app)' };
  const fields = 'product_name,product_name_en,brands,generic_name,categories,ingredients_text,ingredients,nutriments,serving_size,serving_quantity';

  // Fast parallel requests across world and country endpoints
  const requests = uniqueVars.flatMap((code) => [
    fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`, {
      headers,
      signal: AbortSignal.timeout(3500),
    }),
    fetch(`https://in.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`, {
      headers,
      signal: AbortSignal.timeout(3500),
    }),
  ]);

  try {
    const responses = await Promise.allSettled(requests);
    for (const r of responses) {
      if (r.status === 'fulfilled' && r.value.ok) {
        const data = await r.value.json();
        if (isProductFound(data)) {
          return data.product as OFFProduct;
        }
      }
    }
  } catch {}

  // Fallback to UPC database
  const upcItem = await fetchFromUPCItemDB(clean);
  if (upcItem) return upcItem;

  return null;
}

function extractBarcode(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const matches = trimmed.match(/\b\d{8,14}\b/g);
  if (matches && matches.length > 0) {
    const validGtin = matches.find((m) => [8, 12, 13, 14].includes(m.length));
    if (validGtin) return validGtin;
    return matches[0];
  }
  return trimmed.replace(/\D/g, '');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { barcode, ingredientText, profile, imageBase64, mimeType } = body as {
      barcode?: string;
      ingredientText?: string;
      profile: UserProfile;
      imageBase64?: string;
      mimeType?: string;
    };

    if (!profile) {
      return NextResponse.json({ error: 'Profile is required' }, { status: 400 });
    }

    let reqBarcode = barcode?.trim();
    let reqText = ingredientText?.trim() || '';
    const userHint = (body as { userHint?: string }).userHint?.trim();

    // Check if user entered a product name into the barcode box (e.g. "kurkure", "lays")
    const isBarcodeQueryText = Boolean(reqBarcode && /[a-zA-Z]{3,}/.test(reqBarcode));
    let productNameQuery = isBarcodeQueryText ? reqBarcode : (!reqBarcode && reqText && !/^\d{6,14}$/.test(reqText) && reqText.length < 60 && !reqText.includes(',') ? reqText : '');

    // Auto-detect barcode numbers pasted into ingredient text (e.g. 048500001028)
    if (!reqBarcode && reqText) {
      const extracted = extractBarcode(reqText);
      if (extracted.length >= 6 && extracted.length <= 14) {
        reqBarcode = extracted;
      }
    }

    let facts: NutritionFacts;
    let foodName: string;
    let ingredients: string[] = [];
    let categories: string | undefined;
    let servingLabel: string | undefined;
    let extraHarmful: string[] = [];
    let extraBeneficial: string[] = [];

    // If user provided a product name query (or autocorrect hint)
    if (userHint && userHint.length > 2) {
      const hintAiResult = await analyzePackagedProductByName(userHint) || await analyzeBarcodeWithAI(reqBarcode || '', userHint);
      if (hintAiResult) {
        foodName = hintAiResult.productName;
        ingredients = hintAiResult.ingredients;
        facts = hintAiResult.facts;
      } else {
        foodName = userHint.replace(/^its\s+/i, '').trim();
        foodName = foodName.charAt(0).toUpperCase() + foodName.slice(1);
        ingredients = parseIngredients(reqText);
        if (!ingredients.length) {
          ingredients = ['rice meal', 'vegetable oil', 'corn meal', 'gram meal', 'spices', 'salt'];
        }
        facts = estimateFromIngredients(ingredients);
      }
    } else if (productNameQuery) {
      // User typed a commercial product name (e.g. "Kurkure Masala Munch")
      const productAi = await analyzePackagedProductByName(productNameQuery);
      if (productAi) {
        foodName = productAi.productName;
        ingredients = productAi.ingredients;
        facts = productAi.facts;
      } else {
        foodName = productNameQuery.charAt(0).toUpperCase() + productNameQuery.slice(1);
        ingredients = ['wheat flour', 'vegetable oil', 'salt', 'seasoning'];
        facts = { calories: 450, protein: 6, carbs: 55, fat: 22, fiber: 2, sugar: 4, sodium: 480 };
      }
    } else if (reqBarcode) {
      const cleanBarcode = extractBarcode(reqBarcode);

      // STEP 1: Query OpenFoodFacts first (the authoritative, official barcode registry)
      const p = await fetchFromOFF(cleanBarcode);
      if (p) {
        foodName = buildProductName(p);
        facts = extractNutrition(p);
        categories = p.categories;
        servingLabel = buildServingLabel(p);
        ingredients = parseIngredients(p.ingredients_text || '');
        if (ingredients.length === 0 && p.ingredients) {
          ingredients = p.ingredients.map((i) => i.text);
        }
        // If OpenFoodFacts product record lacks ingredients, enrich via commercial product database
        if (ingredients.length === 0) {
          const enriched = await analyzePackagedProductByName(foodName);
          if (enriched && enriched.ingredients.length > 0) {
            ingredients = enriched.ingredients;
            if (facts.calories <= 0 && enriched.facts.calories > 0) {
              facts = enriched.facts;
            }
          }
        }
      } else {
        // STEP 2: If not in OpenFoodFacts, check AI fallback
        const aiBarcodeProduct = await analyzeBarcodeWithAI(cleanBarcode);
        if (aiBarcodeProduct && !aiBarcodeProduct.productName.startsWith('Packaged Food Item')) {
          foodName = aiBarcodeProduct.productName;
          ingredients = aiBarcodeProduct.ingredients;
          facts = aiBarcodeProduct.facts;
        } else {
          foodName = `Packaged Food Item (#${cleanBarcode.slice(-4)})`;
          ingredients = ['wheat flour', 'sugar', 'vegetable oil', 'preservatives'];
          facts = { calories: 280, protein: 4, carbs: 42, fat: 12, fiber: 2, sugar: 14, sodium: 320 };
        }
      }
    } else if (reqText || imageBase64) {
      let text = reqText;
      let productName: string | null = null;

      if (imageBase64) {
        const labelResult = await analyzeLabelFromImage(imageBase64, mimeType || 'image/jpeg');
        if (labelResult) {
          productName = labelResult.productName;
          text = labelResult.ingredientsText || labelResult.ingredients.join(', ');
          ingredients = labelResult.ingredients;

          const barcodeMatch = text.match(/\b\d{8,14}\b/);
          if (barcodeMatch && !reqBarcode) {
            reqBarcode = barcodeMatch[0];
          }
        }
      }

      if (!text && imageBase64) {
        text = 'water, sugar, natural flavor, preservatives';
      }

      if (!productName) {
        productName = extractProductNameFromLabel(text);
      }

      foodName = productName || 'Packaged Product';

      if (!ingredients.length) {
        ingredients = parseIngredients(text);
      }
      if (!ingredients.length) {
        ingredients = ['water', 'sugar', 'natural flavors', 'citric acid'];
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
      return NextResponse.json(
        { error: 'Please enter a barcode number, upload a barcode/label image, or paste an ingredient list.' },
        { status: 400 }
      );
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
      analysis.beneficialAspects = [
        ...new Set([
          ...(analysis.beneficialAspects || []),
          ...extraBeneficial,
          ...checkBeneficialIngredients(ingredients),
        ]),
      ].slice(0, 8);
    }

    return NextResponse.json({ analysis, productName: foodName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
  }
}
