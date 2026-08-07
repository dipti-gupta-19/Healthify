import { GoogleGenerativeAI } from '@google/generative-ai';
import type { NutritionFacts } from './nutrition';
import { matchFoodFromText, findAllFoodMatches, combineFoodNutrition, extractProductNameFromLabel } from './food-db';

export interface ImageFoodAnalysis {
  name: string;
  ingredients: string[];
  facts: NutritionFacts;
  emoji: string;
  source: 'gemini' | 'huggingface' | 'ocr' | 'keyword';
}

export interface LabelAnalysis {
  productName: string;
  ingredients: string[];
  ingredientsText: string;
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function callGeminiVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      prompt,
    ]);
    return result.response.text().trim();
  } catch {
    return null;
  }
}

export async function analyzeFoodFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<ImageFoodAnalysis | null> {
  const prompt = `Analyze this food image. Return ONLY valid JSON with no markdown:
{
  "name": "specific dish name",
  "ingredients": ["ingredient1", "ingredient2"],
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "sodium": number
}
Estimate nutrition for one typical serving. Be specific with the dish name (e.g. "indian thali", "chicken biryani").`;

  const geminiText = await callGeminiVision(imageBase64, mimeType, prompt);
  if (geminiText) {
    const parsed = parseJsonFromText(geminiText);
    if (parsed && parsed.name) {
      return {
        name: String(parsed.name),
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [],
        facts: {
          calories: Number(parsed.calories) || 200,
          protein: Number(parsed.protein) || 8,
          carbs: Number(parsed.carbs) || 25,
          fat: Number(parsed.fat) || 8,
          fiber: Number(parsed.fiber) || 2,
          sugar: Number(parsed.sugar) || 3,
          sodium: Number(parsed.sodium) || 300,
        },
        emoji: '🍽️',
        source: 'gemini',
      };
    }
  }

  const caption = await getImageCaption(imageBase64, mimeType);
  if (caption) {
    const matches = findAllFoodMatches(caption);
    if (matches.length > 0) {
      const combined = combineFoodNutrition(matches);
      return {
        name: combined.name,
        ingredients: matches,
        facts: combined.facts,
        emoji: combined.emoji,
        source: 'huggingface',
      };
    }
    const single = matchFoodFromText(caption);
    if (single) {
      const combined = combineFoodNutrition([single]);
      return {
        name: caption.length < 60 ? caption : single,
        ingredients: [single],
        facts: combined.facts,
        emoji: combined.emoji,
        source: 'huggingface',
      };
    }
    if (/thali|indian|curry|rice|dal|plate of food/i.test(caption)) {
      const combined = combineFoodNutrition(['thali']);
      return {
        name: 'indian thali',
        ingredients: ['rice', 'dal', 'curry', 'roti'],
        facts: combined.facts,
        emoji: combined.emoji,
        source: 'huggingface',
      };
    }
  }

  return null;
}

export async function analyzeLabelFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<LabelAnalysis | null> {
  const prompt = `Read this packaged food label image. Return ONLY valid JSON:
{
  "productName": "product name from package",
  "ingredients": ["ingredient1", "ingredient2"],
  "ingredientsText": "full ingredient list comma separated"
}`;

  const geminiText = await callGeminiVision(imageBase64, mimeType, prompt);
  if (geminiText) {
    const parsed = parseJsonFromText(geminiText);
    if (parsed) {
      return {
        productName: String(parsed.productName || 'Packaged Food'),
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String) : [],
        ingredientsText: String(parsed.ingredientsText || ''),
      };
    }
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

  try {
    const headers: Record<string, string> = { 'Content-Type': mimeType };
    if (hfToken) headers.Authorization = `Bearer ${hfToken}`;

    const res = await fetch(
      'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base',
      { method: 'POST', headers, body: buffer },
    );

    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.generated_text) {
      return data[0].generated_text;
    }
    if (data?.generated_text) return data.generated_text;
    return null;
  } catch {
    return null;
  }
}

export function analyzeTextForFood(text: string): ImageFoodAnalysis | null {
  const matches = findAllFoodMatches(text);
  if (matches.length > 0) {
    const combined = combineFoodNutrition(matches);
    return {
      name: combined.name,
      ingredients: matches,
      facts: combined.facts,
      emoji: combined.emoji,
      source: 'keyword',
    };
  }
  const single = matchFoodFromText(text);
  if (single) {
    const combined = combineFoodNutrition([single]);
    return {
      name: single,
      ingredients: [single],
      facts: combined.facts,
      emoji: combined.emoji,
      source: 'keyword',
    };
  }
  if (/thali|indian food|plate of food|curry|rice and/i.test(text)) {
    const combined = combineFoodNutrition(['thali']);
    return {
      name: 'indian thali',
      ingredients: ['rice', 'dal', 'curry', 'roti'],
      facts: combined.facts,
      emoji: combined.emoji,
      source: 'keyword',
    };
  }
  const productName = extractProductNameFromLabel(text);
  if (productName) {
    const productMatch = matchFoodFromText(productName);
    if (productMatch) {
      const combined = combineFoodNutrition([productMatch]);
      return {
        name: productName,
        ingredients: text.split(/[,;]/).map((s) => s.trim()).filter((s) => s.length > 1),
        facts: combined.facts,
        emoji: combined.emoji,
        source: 'ocr',
      };
    }
  }
  return null;
}

// Legacy exports
export async function identifyFoodFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<string | null> {
  const result = await analyzeFoodFromImage(imageBase64, mimeType);
  return result?.name || null;
}

export async function extractIngredientsFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
): Promise<string | null> {
  const label = await analyzeLabelFromImage(imageBase64, mimeType);
  return label?.ingredientsText || null;
}

export { matchFoodFromText, extractProductNameFromLabel };
