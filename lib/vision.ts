import type { NutritionFacts } from './nutrition';
import { geminiVisionJson, geminiTextJson, hasGeminiKey } from './gemini';
import { pickEmoji } from './food-db';

export interface ImageFoodAnalysis {
  name: string;
  ingredients: string[];
  facts: NutritionFacts;
  emoji: string;
  source: 'gemini' | 'huggingface' | 'ocr' | 'keyword';
  detectedItems?: string[];
  portionDescription?: string;
  highFlags?: string[];
  cuisine?: string;
  cookingMethods?: string[];
  benefits?: string[];
  confidence?: number;
}

export interface LabelAnalysis {
  productName: string;
  ingredients: string[];
  ingredientsText: string;
}

const FOOD_VISION_PROMPT = `You are an expert nutritionist analyzing a food photo.
Identify the dish from ANY cuisine worldwide. List EVERY visible item and ingredient on the plate.
Estimate nutrition for the TOTAL portion shown in the image (sum all items).

Return a single JSON object only — no markdown fences, no commentary.
{
  "name": "specific dish name e.g. North Indian Veg Thali with dal, puri, rice and sabzi",
  "cuisine": "Indian",
  "confidence": 0.9,
  "detectedItems": ["puri", "dal", "rice", "vegetable curry", "pickle"],
  "ingredients": ["wheat flour", "lentils", "rice", "potato", "cauliflower", "spices", "oil", "ghee"],
  "cookingMethods": ["fried", "boiled"],
  "portionDescription": "full thali plate — 5 items visible",
  "benefits": ["protein from dal", "vegetables included"],
  "calories": 850,
  "protein": 22,
  "carbs": 95,
  "fat": 35,
  "fiber": 10,
  "sugar": 8,
  "sodium": 720,
  "highFlags": ["high calories", "high fat"],
  "lowConfidence": false
}

Rules:
- name must be specific to what you SEE
- Sum ALL visible items for total nutrition
- Fried items (puri, pakora) add more fat
- confidence 0-1; lowConfidence true only if truly unidentifiable`;

const LABEL_PROMPT = `Read this packaged food label. Return ONLY JSON:
{"productName":"name","ingredients":["item1"],"ingredientsText":"comma separated list"}`;

const INGREDIENT_ANALYSIS_PROMPT = (productName: string, ingredients: string[]) => `Analyze packaged food "${productName}".
Ingredients: ${ingredients.join(', ')}
Return ONLY JSON: {"harmful":[],"beneficial":[],"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0}`;

const DISH_TEXT_PROMPT = (dishName: string) => `Analyze dish "${dishName}". Return ONLY JSON with name, cuisine, ingredients, cookingMethods, portionDescription, benefits, calories, protein, carbs, fat, fiber, sugar, sodium, highFlags.`;

function factsFromParsed(parsed: Record<string, unknown>): NutritionFacts {
  return {
    calories: Math.round(Number(parsed.calories) || 0),
    protein: Math.round((Number(parsed.protein) || 0) * 10) / 10,
    carbs: Math.round((Number(parsed.carbs) || 0) * 10) / 10,
    fat: Math.round((Number(parsed.fat) || 0) * 10) / 10,
    fiber: Math.round((Number(parsed.fiber) || 0) * 10) / 10,
    sugar: Math.round((Number(parsed.sugar) || 0) * 10) / 10,
    sodium: Math.round(Number(parsed.sodium) || 0),
  };
}

function resultFromParsed(
  parsed: Record<string, unknown>,
  source: ImageFoodAnalysis['source'],
): ImageFoodAnalysis | null {
  const name = String(parsed.name || parsed.dish || '').trim();
  if (!name) return null;

  const facts = factsFromParsed(parsed);
  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [];
  const detectedItems = Array.isArray(parsed.detectedItems) ? parsed.detectedItems.map(String) : [];
  const highFlags = Array.isArray(parsed.highFlags) ? parsed.highFlags.map(String) : [];
  const benefits = Array.isArray(parsed.benefits) ? parsed.benefits.map(String) : [];
  const cookingMethods = Array.isArray(parsed.cookingMethods) ? parsed.cookingMethods.map(String) : [];

  if (facts.calories <= 0 && detectedItems.length >= 2) {
    facts.calories = 600;
  }

  return {
    name,
    ingredients,
    facts,
    emoji: pickEmoji(name),
    source,
    detectedItems,
    portionDescription: String(parsed.portionDescription || ''),
    highFlags,
    cuisine: String(parsed.cuisine || ''),
    cookingMethods,
    benefits,
    confidence: Number(parsed.confidence) || 0.85,
  };
}

export async function analyzeFoodFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<{ result: ImageFoodAnalysis | null; error?: string }> {
  if (!hasGeminiKey()) {
    return { result: null, error: 'GEMINI_API_KEY missing — add it to .env (free at aistudio.google.com)' };
  }

  const { parsed, error } = await geminiVisionJson(imageBase64, mimeType, FOOD_VISION_PROMPT);

  if (parsed) {
    const result = resultFromParsed(parsed, 'gemini');
    if (result) return { result };
  }

  return {
    result: null,
    error: error || 'Could not analyze this photo. Try again in a few moments.',
  };
}

export async function analyzeDishByName(dishName: string): Promise<ImageFoodAnalysis | null> {
  if (!hasGeminiKey() || !dishName.trim()) return null;
  const { parsed } = await geminiTextJson(DISH_TEXT_PROMPT(dishName.trim()));
  if (parsed) return resultFromParsed(parsed, 'gemini');
  return null;
}

export async function analyzeLabelFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<LabelAnalysis | null> {
  if (!hasGeminiKey()) return null;
  const { parsed } = await geminiVisionJson(imageBase64, mimeType, LABEL_PROMPT);
  if (parsed) {
    return {
      productName: String(parsed.productName || 'Packaged Food'),
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [],
      ingredientsText: String(parsed.ingredientsText || ''),
    };
  }
  return null;
}

export interface PackagedIngredientAnalysis {
  harmful: string[];
  beneficial: string[];
  facts?: NutritionFacts;
}

export async function analyzePackagedIngredients(
  productName: string,
  ingredients: string[],
): Promise<PackagedIngredientAnalysis | null> {
  if (!hasGeminiKey() || ingredients.length === 0) return null;
  const { parsed } = await geminiTextJson(INGREDIENT_ANALYSIS_PROMPT(productName, ingredients));
  if (!parsed) return null;
  return {
    harmful: Array.isArray(parsed.harmful) ? parsed.harmful.map(String) : [],
    beneficial: Array.isArray(parsed.beneficial) ? parsed.beneficial.map(String) : [],
    facts: Number(parsed.calories) > 0 ? factsFromParsed(parsed) : undefined,
  };
}

export interface BarcodeAIProduct {
  productName: string;
  ingredients: string[];
  facts: NutritionFacts;
}

/** GS1 company prefix → brand name (reference metadata only — no product data stored here) */
const GS1_BRAND_PREFIXES: Record<string, string> = {
  '8901063': 'Britannia', '8901719': 'Parle', '8901764': 'ITC',
  '8901030': 'Nestle India', '8901058': 'Cadbury (Mondelez India)',
  '8901259': 'PepsiCo India', '8901600': 'Haldiram', '8904323': 'Amul',
  '8901396': 'Marico', '8906011': 'Dabur', '8906002': 'Patanjali',
  '8901514': 'MTR Foods', '8904010': 'Sunfeast (ITC)',
  '0048500': 'Tropicana', '0028400': 'Frito-Lay US',
};

function getBrandFromBarcode(barcode: string): string {
  const clean = barcode.replace(/\D/g, '');
  for (const [prefix, brand] of Object.entries(GS1_BRAND_PREFIXES)) {
    if (clean.startsWith(prefix)) return brand;
  }
  return '';
}

/**
 * Runtime lookup from free barcode databases (no API keys required).
 * Returns a partial product record if found — name/brand only (nutrition comes from AI).
 */
async function fetchFromExternalBarcodeDB(barcode: string): Promise<{ name: string; brand?: string } | null> {
  const clean = barcode.replace(/\D/g, '');
  const headers = { 'User-Agent': 'Healthify/2.0 (healthify-app)' };

  // --- Open EAN (free, no key) ---
  try {
    const res = await fetch(
      `https://openean.kaufkauf.net/?ean=${clean}&cmd=request&lang=en`,
      { headers, signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const text = await res.text();
      // Response is plain text: "productname=...\nproducer=..."
      const nameMatch = text.match(/productname=(.+)/i);
      const brandMatch = text.match(/producer=(.+)/i);
      const name = nameMatch?.[1]?.trim();
      if (name && name !== 'Request Error' && name.length > 2) {
        console.log(`[barcode] Open EAN found: ${name}`);
        return { name, brand: brandMatch?.[1]?.trim() };
      }
    }
  } catch { }

  // --- EAN-Search.org (free tier, 100 req/day) ---
  try {
    const res = await fetch(
      `https://www.ean-search.org/perl/ean-search.pl?q=${clean}&token=free`,
      { headers, signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      const item = Array.isArray(data) ? data[0] : data?.product?.[0];
      if (item?.name && item.name.length > 2) {
        console.log(`[barcode] EAN-Search found: ${item.name}`);
        return { name: item.name, brand: item.issuingCountry };
      }
    }
  } catch { }

  // --- Go UPC (free tier) ---
  try {
    const res = await fetch(
      `https://go-upc.com/api/v1/code/${clean}`,
      { headers, signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.product?.name) {
        console.log(`[barcode] Go-UPC found: ${data.product.name}`);
        return { name: data.product.name, brand: data.product.brand };
      }
    }
  } catch { }

  return null;
}

export async function analyzeBarcodeWithAI(barcode: string, userHint?: string): Promise<BarcodeAIProduct | null> {
  const clean = barcode.replace(/\D/g, '');

  if (!hasGeminiKey() && !userHint) return null;

  // STEP 1: Identify brand from GS1 prefix (no hardcoded product data — just company metadata)
  const brandFromPrefix = getBrandFromBarcode(clean);
  const isIndian = clean.startsWith('890');

  // STEP 2: Try free barcode databases at runtime to get the product name
  let runtimeName: string | undefined;
  let runtimeBrand: string | undefined;
  const dbResult = await fetchFromExternalBarcodeDB(clean);
  if (dbResult) {
    runtimeName = dbResult.name;
    runtimeBrand = dbResult.brand || brandFromPrefix;
  }

  // STEP 3: Build AI prompt enriched with all available runtime context
  const productHint = runtimeName
    ? `The product name from a barcode registry is: "${runtimeName}"${runtimeBrand ? ` (brand: ${runtimeBrand})` : ''}. Use this to identify the exact product.`
    : userHint
      ? `The user identifies this as: "${userHint}".`
      : brandFromPrefix
        ? `GS1 prefix ${clean.slice(0, 7)} identifies the manufacturer as "${brandFromPrefix}".`
        : '';

  const context = userHint
    ? `User hint: "${userHint}". ${productHint}`
    : runtimeName
      ? `Barcode ${clean}: ${productHint} Provide exact ingredients from label and nutrition facts per 100g.`
      : brandFromPrefix
        ? `Barcode ${clean} is a ${isIndian ? 'Indian' : ''} product from "${brandFromPrefix}". Identify the exact product variant and provide real label ingredients and nutrition per 100g.`
        : `Barcode ${clean} (${isIndian ? 'Indian market' : 'unknown origin'}). Identify this packaged food product. Set "found": false if not confident.`;

  const prompt = `${context}

Return ONLY valid JSON (no markdown):
{
  "found": true,
  "productName": "Exact Brand + Full Product Name",
  "ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fiber": 0,
  "sugar": 0,
  "sodium": 0
}`;

  if (hasGeminiKey()) {
    const { parsed } = await geminiTextJson(prompt);
    if (parsed && parsed.found !== false && (parsed.productName || parsed.name)) {
      const name = String(parsed.productName || parsed.name);
      if (name && !name.toLowerCase().includes('unknown') && !name.toLowerCase().includes('not found')) {
        console.log(`[barcode] AI identified: ${name}`);
        return {
          productName: name,
          ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [],
          facts: factsFromParsed(parsed),
        };
      }
    }
  }

  // STEP 4: If AI fails but we have a runtime name, return it with zero nutrition
  // (the route.ts will enrich nutrition via analyzePackagedProductByName)
  if (runtimeName) {
    return {
      productName: runtimeBrand ? `${runtimeBrand} ${runtimeName}` : runtimeName,
      ingredients: [],
      facts: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
    };
  }

  return null;
}

/**
 * Recognizes commercial packaged food by product name or brand (e.g. "Kurkure Masala Munch", "Lays Magic Masala", "Oreo")
 */
export async function analyzePackagedProductByName(productName: string): Promise<BarcodeAIProduct | null> {
  const clean = productName.trim();
  if (!clean || clean.length < 2) return null;
  if (!hasGeminiKey()) return null;

  const prompt = `You are an expert food scientist and grocery database.
Identify the commercial packaged food product "${clean}".
Provide the official commercial brand name, full product name, the real ingredient list from the packaging label, and standard nutrition facts per 100g.

Return ONLY a single valid JSON object:
{
  "productName": "Brand + Product Name",
  "ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fiber": 0,
  "sugar": 0,
  "sodium": 0
}`;

  const { parsed } = await geminiTextJson(prompt);
  if (parsed && (parsed.productName || parsed.name)) {
    return {
      productName: String(parsed.productName || parsed.name),
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [],
      facts: factsFromParsed(parsed),
    };
  }
  return null;
}


