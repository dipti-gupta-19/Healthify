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
  const cleaned = text
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I')
    .replace(/\bingredients?\s*[:\-]?\s*/i, '')
    .split(/\b(?:nutrition facts|allergens?|contains|may contain|distributed by|net weight)\b/i)[0];

  return cleaned
    .split(/[,;()]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^\d+$/.test(s) && !/^\d+\s*(cal|kcal|g|mg|%)$/i.test(s))
    .slice(0, 60);
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
  if (!data.product) return false;
  // OFF returns status as number 1 (found) or 0 (not found). Some endpoints return string.
  const s = data.status;
  return s === 1 || s === '1' || s === 'success';
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

  // Prefer _100g fields; fall back to serving fields; then plain field name
  const pick = (base: string): number =>
    Number(n[`${base}_100g`]) ||
    Number(n[`${base}_serving`]) ||
    Number(n[base]) ||
    0;

  const caloriesPer100g =
    pick('energy-kcal') ||
    Math.round((pick('energy') || 0) / 4.184); // kJ → kcal

  let sodiumMg = 0;
  const rawSodium = pick('sodium');
  if (rawSodium > 0) {
    // OFF stores sodium in g per 100g; if < 10 it's grams, otherwise mg
    sodiumMg = rawSodium < 10 ? Math.round(rawSodium * 1000) : Math.round(rawSodium);
  } else {
    const rawSalt = pick('salt');
    if (rawSalt > 0) {
      // salt → sodium: sodium = salt × 0.4 (g), convert to mg
      sodiumMg = rawSalt < 10 ? Math.round(rawSalt * 400) : Math.round(rawSalt * 0.4);
    }
  }

  return {
    calories: Math.round(caloriesPer100g * scale),
    protein: Math.round(pick('proteins') * scale * 10) / 10,
    carbs: Math.round(pick('carbohydrates') * scale * 10) / 10,
    fat: Math.round(pick('fat') * scale * 10) / 10,
    fiber: Math.round(pick('fiber') * scale * 10) / 10,
    sugar: Math.round(pick('sugars') * scale * 10) / 10,
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

/**
 * Fetch product from Open Food Facts with multi-level fallback:
 * 1. OFF v2 world + India direct product lookup (parallel)
 * 2. OFF v0 legacy API (sometimes has products v2 misses)
 * 3. OFF search API by barcode (catches partial/variant barcodes)
 * 4. UPC Item DB (US-centric fallback)
 */
async function fetchFromOFF(barcodeCode: string): Promise<OFFProduct | null> {
  const clean = barcodeCode.replace(/\D/g, '');
  if (!clean || clean.length < 6) return null;

  // Build barcode variants (EAN-13 vs UPC-A differences)
  const variations = new Set([clean]);
  if (clean.length === 12) variations.add(`0${clean}`);
  if (clean.length === 13 && clean.startsWith('0')) variations.add(clean.slice(1));
  const codes = [...variations];

  const headers = { 'User-Agent': 'Healthify/2.0 (https://github.com/healthify; contact@healthify.app)' };
  const fields = 'product_name,product_name_en,brands,generic_name,categories,ingredients_text,ingredients,nutriments,serving_size,serving_quantity';

  // --- STEP 1: v2 API direct lookup (world + India endpoints in parallel) ---
  const v2Requests = codes.flatMap((code) => [
    fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    }),
    fetch(`https://in.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    }),
  ]);

  try {
    const results = await Promise.allSettled(v2Requests);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        const data = await r.value.json();
        if (isProductFound(data)) {
          console.log(`[OFF] Found via v2 API: ${(data.product as OFFProduct).product_name || codes[0]}`);
          return data.product as OFFProduct;
        }
      }
    }
  } catch (e) {
    console.warn('[OFF] v2 lookup error:', e);
  }

  // --- STEP 2: v0 legacy API (different DB shard, often has Indian products) ---
  for (const code of codes) {
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/product/${code}.json`,
        { headers, signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (isProductFound(data)) {
          console.log(`[OFF] Found via v0 legacy API: ${(data.product as OFFProduct).product_name || code}`);
          return data.product as OFFProduct;
        }
      }
    } catch {}
  }

  // --- STEP 3: OFF Search API by barcode (handles variant codes & typos) ---
  try {
    const searchRes = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?code=${clean}&action=process&json=1&fields=${fields}&page_size=1`,
      { headers, signal: AbortSignal.timeout(5000) }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.products && Array.isArray(searchData.products) && searchData.products.length > 0) {
        const p = searchData.products[0] as OFFProduct;
        if (p.product_name || p.brands) {
          console.log(`[OFF] Found via search API: ${p.product_name || p.brands || clean}`);
          return p;
        }
      }
    }
  } catch (e) {
    console.warn('[OFF] Search API error:', e);
  }

  // --- STEP 4: UPC Item DB fallback ---
  const upcItem = await fetchFromUPCItemDB(clean);
  if (upcItem) {
    console.log(`[OFF] Found via UPCItemDB: ${upcItem.product_name || clean}`);
    return upcItem;
  }

  console.warn(`[OFF] Product not found for barcode: ${clean}`);
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
      const prefix = cleanBarcode.slice(0, 3); // GS1 prefix: 890=India, 400-440=Germany, 000-019=USA
      const countryHint = prefix === '890' ? 'Indian' : prefix.match(/^4[0-4]\d$/) ? 'German' : prefix.match(/^0[01]\d$/) ? 'US' : '';

      // STEP 1: Query OpenFoodFacts (authoritative barcode registry, 4-level fallback inside)
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

        // Enrich missing ingredients OR zero-calorie nutrition via AI
        const needsEnrichment = ingredients.length === 0 || facts.calories <= 0;
        if (needsEnrichment) {
          const enriched = await analyzePackagedProductByName(foodName);
          if (enriched) {
            if (ingredients.length === 0 && enriched.ingredients.length > 0) {
              ingredients = enriched.ingredients;
            }
            if (facts.calories <= 0 && enriched.facts.calories > 0) {
              facts = enriched.facts;
            }
          }
        }

        // If nutrition is still zero after enrichment, estimate from ingredients
        if (facts.calories <= 0 && ingredients.length > 0) {
          facts = estimateFromIngredients(ingredients);
        }
      } else {
        // STEP 2: Not in OpenFoodFacts — try AI barcode lookup with country context
        const aiBarcodeProduct = await analyzeBarcodeWithAI(
          cleanBarcode,
          countryHint ? `${countryHint} product, barcode ${cleanBarcode}` : undefined,
        );
        if (aiBarcodeProduct && !aiBarcodeProduct.productName.startsWith('Packaged Food Item')) {
          foodName = aiBarcodeProduct.productName;
          ingredients = aiBarcodeProduct.ingredients;
          facts = aiBarcodeProduct.facts;
          // Validate AI facts — if zeros, estimate from ingredients
          if (facts.calories <= 0 && ingredients.length > 0) {
            facts = estimateFromIngredients(ingredients);
          }
        } else {
          // Absolute fallback — show full barcode so user can identify manually
          foodName = `${countryHint ? countryHint + ' ' : ''}Packaged Food (Barcode: ${cleanBarcode})`;
          ingredients = [];
          facts = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
        }

        if (facts.calories === 0 && ingredients.length > 0) {
          facts = estimateFromIngredients(ingredients);
        }
      } else {
        return NextResponse.json(
          {
            error: `No product was found for barcode ${cleanBarcode}. Try a clearer barcode scan or upload the ingredient label.`,
          },
          { status: 404 },
        );
      }
    } else if (reqText || imageBase64) {
      let text = reqText;
      let productName: string | null = null;

      // Prefer text already extracted by the browser OCR over a second AI
      // transcription of the same label.
      if (imageBase64 && !text) {
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
        return NextResponse.json(
          { error: 'The label could not be read. Upload a clearer ingredient-label photo.' },
          { status: 422 },
        );
      }

      if (!productName) {
        productName = extractProductNameFromLabel(text);
      }

      foodName = productName || 'Packaged Product';

      if (!ingredients.length) {
        ingredients = parseIngredients(text);
      }
      if (!ingredients.length) {
        return NextResponse.json(
          { error: 'No ingredients were detected. Paste the ingredient list or upload a clearer label photo.' },
          { status: 422 },
        );
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
