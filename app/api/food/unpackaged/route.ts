import { NextResponse } from 'next/server';
import {
  analyzeFood,
  type NutritionFacts,
  type UserProfile,
} from '@/lib/nutrition';
import { analyzeFoodFromImage, analyzeTextForFood } from '@/lib/vision';
import { findFoodMatch } from '@/lib/food-db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { foodName, profile, imageBase64, ocrText, mimeType } = body as {
      foodName?: string;
      profile: UserProfile;
      imageBase64?: string;
      ocrText?: string;
      mimeType?: string;
    };

    if (!profile) {
      return NextResponse.json({ error: 'Profile is required' }, { status: 400 });
    }

    let resolvedName = foodName?.trim() || '';
    let identifiedBy: string | null = null;
    let ingredients: string[] = [];
    let facts: NutritionFacts | null = null;
    let emoji = '🍽️';

    if (imageBase64) {
      const imageResult = await analyzeFoodFromImage(imageBase64, mimeType || 'image/jpeg');
      if (imageResult) {
        resolvedName = imageResult.name;
        ingredients = imageResult.ingredients;
        facts = imageResult.facts;
        emoji = imageResult.emoji;
        identifiedBy = imageResult.source;
      }
    }

    if (!resolvedName && ocrText) {
      const textResult = analyzeTextForFood(ocrText);
      if (textResult) {
        resolvedName = textResult.name;
        ingredients = textResult.ingredients;
        facts = textResult.facts;
        emoji = textResult.emoji;
        identifiedBy = 'ocr';
      } else {
        resolvedName = ocrText.split(/[\n,]/)[0].trim().slice(0, 80);
        identifiedBy = 'ocr';
      }
    }

    if (!resolvedName && !facts) {
      if (imageBase64) {
        const fallback = findFoodMatch('thali');
        if (fallback) {
          resolvedName = 'restaurant meal (estimated)';
          facts = fallback.entry.facts;
          emoji = fallback.entry.emoji;
          identifiedBy = 'keyword';
          ingredients = ['rice', 'dal', 'curry', 'vegetables'];
        }
      }
      if (!resolvedName) {
        return NextResponse.json({ error: 'Could not identify food from image. Add GEMINI_API_KEY in .env for best results, or type the dish name.' }, { status: 400 });
      }
    }

    if (!facts) {
      const match = findFoodMatch(resolvedName);
      if (match) {
        facts = match.entry.facts;
        emoji = match.entry.emoji;
        resolvedName = match.key;
      } else {
        facts = { calories: 200, protein: 8, carbs: 25, fat: 8, fiber: 2, sugar: 3, sodium: 300 };
      }
    }

    const analysis = analyzeFood(resolvedName, facts, profile, ingredients);
    analysis.emoji = emoji;
    analysis.ingredients = ingredients.length > 0 ? ingredients : analysis.ingredients;

    if (identifiedBy === 'gemini' || identifiedBy === 'huggingface') {
      analysis.recommendation = `Identified from photo as "${resolvedName}" — nutrition estimated from image analysis.`;
    } else if (identifiedBy === 'ocr') {
      analysis.recommendation = `Detected from image text — verify portion size for accuracy.`;
    } else if (identifiedBy === 'keyword' && imageBase64) {
      analysis.recommendation = 'Estimated from photo — add GEMINI_API_KEY for precise dish identification.';
    }

    return NextResponse.json({ analysis, identifiedName: resolvedName, identifiedBy });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
  }
}
