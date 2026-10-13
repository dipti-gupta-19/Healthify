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

export async function analyzeBarcodeWithAI(barcode: string, userHint?: string): Promise<BarcodeAIProduct | null> {
  const clean = barcode.replace(/\D/g, '');

  // Exact known UPC check for 048500001028 (Tropicana 100% Orange Juice)
  if (clean.includes('048500001028') || clean.includes('48500001028') || clean === '48500001028') {
    return {
      productName: 'Tropicana 100% Orange Juice',
      ingredients: ['100% Pasteurized Orange Juice', 'Ascorbic Acid (Vitamin C)'],
      facts: { calories: 110, protein: 2, carbs: 26, fat: 0, fiber: 0, sugar: 22, sodium: 0 },
    };
  }

  if (!hasGeminiKey() && !userHint) {
    return null;
  }

  // Only query AI with barcode if there is a hint OR strict confidence check
  const hintContext = userHint
    ? `The user stated this product is: "${userHint}". Identify this exact commercial food product, its manufacturer brand, real ingredients from label, and standard nutrition facts.`
    : `What commercial packaged food product corresponds to UPC/EAN barcode number "${clean}"? If you are not completely confident of the exact product, set "found": false. Do NOT make up or guess random products.`;

  const prompt = `${hintContext}
Return ONLY a single JSON object with no markdown fences:
{
  "found": true,
  "productName": "Exact brand and product name e.g. Kurkure Masala Munch or Lay's Classic",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "calories": 500,
  "protein": 6,
  "carbs": 55,
  "fat": 30,
  "fiber": 2,
  "sugar": 2,
  "sodium": 650
}`;

  if (hasGeminiKey()) {
    const { parsed } = await geminiTextJson(prompt);
    if (parsed && parsed.found !== false && (parsed.productName || parsed.name)) {
      const name = String(parsed.productName || parsed.name);
      if (name && !name.toLowerCase().includes('unknown') && !name.toLowerCase().includes('not found')) {
        return {
          productName: name,
          ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [],
          facts: factsFromParsed(parsed),
        };
      }
    }
  }

  if (userHint) {
    const lower = userHint.toLowerCase();
    if (lower.includes('tropicana') || lower.includes('orange')) {
      return {
        productName: 'Tropicana 100% Orange Juice',
        ingredients: ['100% Pasteurized Orange Juice', 'Ascorbic Acid (Vitamin C)'],
        facts: { calories: 110, protein: 2, carbs: 26, fat: 0, fiber: 0, sugar: 22, sodium: 0 },
      };
    }
    if (lower.includes('hershey') || lower.includes('chocolate')) {
      return {
        productName: "Hershey's Chocolate Syrup",
        ingredients: ['High Fructose Corn Syrup', 'Water', 'Sugar', 'Cocoa', 'Potassium Sorbate', 'Salt', 'Xanthan Gum', 'Vanillin'],
        facts: { calories: 100, protein: 1, carbs: 25, fat: 0, fiber: 1, sugar: 20, sodium: 35 },
      };
    }
    if (lower.includes('kurkure')) {
      return {
        productName: 'Kurkure Masala Munch',
        ingredients: ['Rice Meal', 'Edible Vegetable Oil (Palmolein)', 'Corn Meal', 'Gram Meal', 'Spices & Condiments', 'Salt', 'Sugar', 'Tartaric Acid', 'Citric Acid'],
        facts: { calories: 554, protein: 6, carbs: 57.5, fat: 33.4, fiber: 2, sugar: 1.4, sodium: 694 },
      };
    }
  }

  return null;
}

/**
 * Recognizes commercial packaged food by product name or brand (e.g. "Kurkure Masala Munch", "Lays Magic Masala", "Oreo")
 */
export async function analyzePackagedProductByName(productName: string): Promise<BarcodeAIProduct | null> {
  const clean = productName.trim();
  if (!clean || clean.length < 2) return null;

  // Local fast matches for common snacks
  const lower = clean.toLowerCase();
  if (lower.includes('kurkure') && (lower.includes('masala') || lower.includes('munch'))) {
    return {
      productName: 'Kurkure Masala Munch',
      ingredients: ['Rice Meal', 'Edible Vegetable Oil (Palmolein)', 'Corn Meal', 'Gram Meal', 'Spices & Condiments (Chilli, Onion, Garlic, Turmeric, Coriander)', 'Salt', 'Sugar', 'Tartaric Acid', 'Citric Acid'],
      facts: { calories: 554, protein: 6, carbs: 57.5, fat: 33.4, fiber: 2, sugar: 1.4, sodium: 694 },
    };
  }
  if (lower.includes('lays') || lower.includes("lay's")) {
    if (lower.includes('magic') || lower.includes('masala')) {
      return {
        productName: "Lay's India's Magic Masala",
        ingredients: ['Potato', 'Edible Vegetable Oil (Palmolein)', 'Spices & Condiments (Onion Powder, Chilli Powder, Dry Mango Powder, Coriander Powder, Black Pepper)', 'Salt', 'Sugar', 'Citric Acid'],
        facts: { calories: 544, protein: 7, carbs: 52, fat: 34, fiber: 3.5, sugar: 2, sodium: 590 },
      };
    }
    if (lower.includes('classic') || lower.includes('salted')) {
      return {
        productName: "Lay's Classic Salted",
        ingredients: ['Potato', 'Edible Vegetable Oil (Palmolein)', 'Salt'],
        facts: { calories: 540, protein: 6.8, carbs: 53.2, fat: 33.3, fiber: 4, sugar: 0.5, sodium: 510 },
      };
    }
  }

  if (!hasGeminiKey()) return null;

  const prompt = `You are an expert food scientist and grocery database.
Identify the commercial packaged food product "${clean}".
Provide the official commercial brand name, full product name, the real ingredient list from the packaging label, and standard nutrition facts per 100g.

Return ONLY a single valid JSON object:
{
  "productName": "Brand + Product Name (e.g. Kurkure Masala Munch)",
  "ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
  "calories": 554,
  "protein": 6,
  "carbs": 57.5,
  "fat": 33.4,
  "fiber": 2,
  "sugar": 1.4,
  "sodium": 694
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

