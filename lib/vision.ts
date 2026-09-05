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

Return ONLY valid JSON:
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

const CAPTION_TO_FOOD_PROMPT = (caption: string) => `A food photo was described as: "${caption}"
Identify the dish, list ingredients, estimate nutrition for one restaurant portion.

Return ONLY JSON:
name, cuisine, confidence, detectedItems, ingredients, cookingMethods, portionDescription, benefits,
calories, protein, carbs, fat, fiber, sugar, sodium, highFlags, lowConfidence`;

const LABEL_PROMPT = `Read this packaged food label. Return ONLY JSON:
{"productName":"name","ingredients":["item1"],"ingredientsText":"comma separated list"}`;

const INGREDIENT_ANALYSIS_PROMPT = (productName: string, ingredients: string[]) => `Analyze packaged food "${productName}".
Ingredients: ${ingredients.join(', ')}
Return ONLY JSON: {"harmful":[],"beneficial":[],"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"sodium":0}`;

const DISH_TEXT_PROMPT = (dishQuery: string) => `You are an elite clinical dietitian and nutrition database AI analyzing an unpackaged home-cooked meal, restaurant dish, or snack.
The user is describing what they ate or plan to eat, including quantities and portion sizes.

User Meal Description: "${dishQuery}"

CRITICAL INSTRUCTIONS:
1. QUANTITY & PORTION SCALING:
   - Carefully parse all counts, weights, volume units, or serving sizes mentioned (e.g. "2 rotis", "1 bowl dal", "150g chicken", "2 eggs", "1 plate biryani", "1 cup rice", "half portion", "large bowl").
   - Calculate the CUMULATIVE nutrition facts for the TOTAL quantity described by the user.
   - If no quantity is specified, assume a standard single adult serving size and clearly note that in "portionDescription".
2. MULTI-ITEM BREAKDOWN:
   - If the meal contains multiple dishes/items, list EACH item with its estimated quantity in "detectedItems" (e.g. ["2 rotis (~80g)", "1 medium bowl dal tadka (~180g)", "1 small bowl cucumber salad (~70g)"]).
3. INGREDIENTS:
   - Extract the real cooking ingredients (e.g. ["whole wheat flour", "yellow lentils", "onion", "tomato", "cumin", "ghee", "turmeric"]).
4. NUTRITION FACTS:
   - Accurately calculate: calories (kcal), protein (g), carbs (g), fat (g), fiber (g), sugar (g), sodium (mg).
5. HEALTH HIGHLIGHTS:
   - "benefits": 2-3 genuine health benefits (e.g. ["High quality protein", "Complex carbohydrates with good fiber"]).
   - "highFlags": flag any elevated metrics (e.g. "high sodium", "high calories", "high fat", "high protein", "high sugar").

Return ONLY valid JSON matching this exact structure:
{
  "name": "Recognizable meal title matching quantity (e.g. '2 Rotis with Dal Tadka & Salad')",
  "cuisine": "e.g. Indian, Italian, Continental, Chinese, etc.",
  "confidence": 0.95,
  "detectedItems": ["item 1 with qty", "item 2 with qty"],
  "ingredients": ["ingredient1", "ingredient2", "ingredient3"],
  "cookingMethods": ["boiled", "pan-roasted"],
  "portionDescription": "detailed breakdown of the analyzed portions and estimated gram/ml weights",
  "benefits": ["benefit 1", "benefit 2"],
  "calories": 380,
  "protein": 14,
  "carbs": 58,
  "fat": 8,
  "fiber": 9,
  "sugar": 4,
  "sodium": 520,
  "highFlags": ["high fiber"]
}`;

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
    facts.protein = 15;
    facts.carbs = 70;
    facts.fat = 25;
  } else if (facts.calories <= 0) {
    facts.calories = 350;
    facts.protein = 10;
    facts.carbs = 40;
    facts.fat = 12;
  }

  return {
    name,
    ingredients: ingredients.length ? ingredients : detectedItems,
    facts,
    emoji: pickEmoji(name, detectedItems),
    source,
    detectedItems,
    portionDescription: String(parsed.portionDescription || ''),
    highFlags,
    cuisine: String(parsed.cuisine || ''),
    cookingMethods,
    benefits,
    confidence: Number(parsed.confidence) || undefined,
  };
}

async function tryVisionAnalysis(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  opts?: { jsonMode?: boolean; useGoogleSearch?: boolean; models?: string[] },
): Promise<ImageFoodAnalysis | null> {
  const { parsed } = await geminiVisionJson(imageBase64, mimeType, prompt, opts);
  if (parsed) {
    const result = resultFromParsed(parsed, 'gemini');
    if (result) return result;
  }
  return null;
}

export async function getImageCaption(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<string | null> {
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const models = [
    'Salesforce/blip-image-captioning-large',
    'Salesforce/blip-image-captioning-base',
  ];

  for (const model of models) {
    try {
      const headers: Record<string, string> = { 'Content-Type': mimeType };
      if (hfToken) headers.Authorization = `Bearer ${hfToken}`;

      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        { method: 'POST', headers, body: buffer, signal: AbortSignal.timeout(15000) },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
      if (data?.generated_text) return data.generated_text;
    } catch {
      continue;
    }
  }
  return null;
}

export async function analyzeFoodFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<{ result: ImageFoodAnalysis | null; error?: string }> {
  if (!hasGeminiKey()) {
    return { result: null, error: 'GEMINI_API_KEY missing — add it to .env (free at aistudio.google.com)' };
  }

  // Single API call — gemini-2.5-flash-lite (best free-tier limits)
  const { parsed, error } = await geminiVisionJson(imageBase64, mimeType, FOOD_VISION_PROMPT);

  if (parsed) {
    const result = resultFromParsed(parsed, 'gemini');
    if (result) return { result };
  }

  return {
    result: null,
    error: error || 'AI could not analyze this photo. Wait a few minutes and try Scan & Analyze once.',
  };
}

export function fallbackDishEstimate(query: string): ImageFoodAnalysis {
  const q = query.toLowerCase();

  let calories = 200;
  let protein = 6;
  let carbs = 30;
  let fat = 6;
  let fiber = 3;
  let sugar = 3;
  let sodium = 300;
  const detectedItems: string[] = [];
  const ingredients: string[] = [];
  const benefits: string[] = ['Balanced home-cooked meal'];

  // Check for rotis / chapatis
  const rotiMatch = q.match(/(\d+)\s*(roti|chapat|phulka|flatbread)/i);
  if (rotiMatch || q.includes('roti') || q.includes('chapat')) {
    const count = rotiMatch ? parseInt(rotiMatch[1], 10) || 2 : 2;
    calories += count * 85;
    protein += count * 3.2;
    carbs += count * 16;
    fat += count * 1.5;
    fiber += count * 2.2;
    detectedItems.push(`${count} Chapatis/Rotis (~${count * 40}g)`);
    ingredients.push('whole wheat flour', 'water', 'oil/ghee');
  }

  // Check for dal / lentils
  if (q.includes('dal') || q.includes('lentil') || q.includes('sambar') || q.includes('tadka')) {
    calories += 140;
    protein += 8;
    carbs += 20;
    fat += 3.5;
    fiber += 5;
    sodium += 350;
    detectedItems.push('1 bowl Dal / Lentils (~180ml)');
    ingredients.push('yellow/red lentils', 'turmeric', 'cumin', 'ghee/oil');
    benefits.push('Good plant-based protein and gut-friendly dietary fiber');
  }

  // Check for rice
  if (q.includes('rice') || q.includes('chawal')) {
    calories += 180;
    protein += 3.5;
    carbs += 40;
    fat += 0.5;
    detectedItems.push('1 cup cooked Rice (~150g)');
    ingredients.push('rice', 'water');
  }

  // Check for biryani / pulao
  if (q.includes('biryani') || q.includes('pulao')) {
    calories += 450;
    protein += 18;
    carbs += 55;
    fat += 18;
    sodium += 600;
    detectedItems.push('1 plate Biryani/Pulao (~300g)');
    ingredients.push('basmati rice', 'spices', 'ghee/oil');
    benefits.push('Flavorful traditional spiced rice meal');
  }

  // Check for chicken / meat / fish
  if (q.includes('chicken') || q.includes('meat') || q.includes('fish') || q.includes('mutton')) {
    calories += 190;
    protein += 26;
    fat += 8;
    sodium += 220;
    detectedItems.push('Lean Chicken / Meat portion (~150g)');
    ingredients.push('chicken/meat', 'cooking spices');
    benefits.push('High-quality complete protein for muscle maintenance and satiety');
  }

  // Check for paneer / tofu
  if (q.includes('paneer') || q.includes('tofu')) {
    calories += 210;
    protein += 14;
    fat += 16;
    carbs += 4;
    detectedItems.push('Paneer / Tofu portion (~120g)');
    ingredients.push('paneer/tofu', 'spices');
    benefits.push('Rich in calcium and healthy dietary fats');
  }

  // Check for eggs
  const eggMatch = q.match(/(\d+)\s*(egg|anda)/i);
  if (eggMatch || q.includes('egg') || q.includes('omelette') || q.includes('scramble')) {
    const count = eggMatch ? parseInt(eggMatch[1], 10) || 2 : 2;
    calories += count * 75;
    protein += count * 6.5;
    fat += count * 5;
    detectedItems.push(`${count} Eggs`);
    ingredients.push('eggs');
    benefits.push('Complete amino acid profile and high choline');
  }

  // Check for salad
  if (q.includes('salad') || q.includes('cucumber') || q.includes('tomato')) {
    calories += 30;
    fiber += 2.5;
    detectedItems.push('Fresh Vegetable Salad (~80g)');
    ingredients.push('cucumber', 'tomato', 'lemon');
    benefits.push('Hydrating and packed with essential micronutrients');
  }

  const nameTitle = query.slice(0, 45).replace(/^\w/, (c) => c.toUpperCase());

  return {
    name: nameTitle,
    facts: {
      calories: Math.max(120, Math.round(calories)),
      protein: Math.max(2, Math.round(protein * 10) / 10),
      carbs: Math.max(5, Math.round(carbs * 10) / 10),
      fat: Math.max(2, Math.round(fat * 10) / 10),
      fiber: Math.max(1, Math.round(fiber * 10) / 10),
      sugar: Math.round(sugar * 10) / 10,
      sodium: Math.round(sodium),
    },
    ingredients: ingredients.length ? ingredients : ['fresh cooking ingredients', 'spices'],
    emoji: pickEmoji(query, detectedItems),
    source: 'keyword',
    confidence: 0.88,
    detectedItems: detectedItems.length ? detectedItems : [query],
    portionDescription: detectedItems.length ? detectedItems.join(' + ') : 'Estimated portion from your description',
    cookingMethods: ['home cooked'],
    benefits,
    cuisine: 'Home Cooked',
  };
}

export async function analyzeDishByName(dishName: string): Promise<ImageFoodAnalysis | null> {
  const trimmed = dishName.trim();
  if (!trimmed) return null;

  if (hasGeminiKey()) {
    try {
      const { parsed } = await geminiTextJson(DISH_TEXT_PROMPT(trimmed));
      if (parsed) {
        const result = resultFromParsed(parsed, 'gemini');
        if (result) return result;
      }
    } catch {
      // Fall through to smart fallback
    }
  }

  return fallbackDishEstimate(trimmed);
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

export async function identifyFoodFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<string | null> {
  const { result } = await analyzeFoodFromImage(imageBase64, mimeType);
  return result?.name || null;
}

export async function extractIngredientsFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<string | null> {
  const label = await analyzeLabelFromImage(imageBase64, mimeType);
  return label?.ingredientsText || null;
}

export { extractProductNameFromLabel, matchFoodFromText } from './food-db';
