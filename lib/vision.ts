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
