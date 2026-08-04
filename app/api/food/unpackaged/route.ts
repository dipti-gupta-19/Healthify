import { NextResponse } from 'next/server';
import {
  analyzeFood,
  type NutritionFacts,
  type UserProfile,
} from '@/lib/nutrition';

const FOOD_DB: Record<string, { facts: NutritionFacts; emoji: string }> = {
  'roti': { facts: { calories: 120, protein: 3.1, carbs: 18, fat: 3.7, fiber: 2.7, sugar: 0.5, sodium: 134 }, emoji: '🫓' },
  'dal': { facts: { calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sugar: 2, sodium: 240 }, emoji: '🥣' },
  'rice': { facts: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 1 }, emoji: '🍚' },
  'chicken curry': { facts: { calories: 253, protein: 21, carbs: 4, fat: 18, fiber: 1, sugar: 1, sodium: 580 }, emoji: '🍛' },
  'paneer': { facts: { calories: 265, protein: 18, carbs: 1.2, fat: 20, fiber: 0, sugar: 1.2, sodium: 300 }, emoji: '🧀' },
  'pizza': { facts: { calories: 285, protein: 12, carbs: 36, fat: 10, fiber: 2.5, sugar: 3.6, sodium: 598 }, emoji: '🍕' },
  'burger': { facts: { calories: 295, protein: 17, carbs: 24, fat: 14, fiber: 1.5, sugar: 4, sodium: 396 }, emoji: '🍔' },
  'salad': { facts: { calories: 152, protein: 5, carbs: 12, fat: 10, fiber: 4, sugar: 3, sodium: 200 }, emoji: '🥗' },
  'pasta': { facts: { calories: 220, protein: 8, carbs: 43, fat: 1.3, fiber: 2.5, sugar: 1, sodium: 6 }, emoji: '🍝' },
  'noodles': { facts: { calories: 188, protein: 4, carbs: 27, fat: 7, fiber: 1, sugar: 1, sodium: 460 }, emoji: '🍜' },
  'dosa': { facts: { calories: 168, protein: 4, carbs: 29, fat: 4, fiber: 1, sugar: 1, sodium: 295 }, emoji: '🥞' },
  'idli': { facts: { calories: 58, protein: 2, carbs: 12, fat: 0.4, fiber: 1, sugar: 0.3, sodium: 98 }, emoji: '⚪' },
  'samosa': { facts: { calories: 308, protein: 6, carbs: 24, fat: 22, fiber: 2, sugar: 2, sodium: 420 }, emoji: '🥟' },
  'biryani': { facts: { calories: 202, protein: 9, carbs: 27, fat: 6, fiber: 1.5, sugar: 1, sodium: 350 }, emoji: '🍚' },
  'egg': { facts: { calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0, sugar: 0.6, sodium: 62 }, emoji: '🥚' },
  'omelette': { facts: { calories: 154, protein: 11, carbs: 1, fat: 12, fiber: 0, sugar: 1, sodium: 155 }, emoji: '🍳' },
  'oats': { facts: { calories: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sugar: 1, sodium: 2 }, emoji: '🥣' },
  'banana': { facts: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12, sodium: 1 }, emoji: '🍌' },
  'apple': { facts: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, sodium: 1 }, emoji: '🍎' },
  'sandwich': { facts: { calories: 250, protein: 9, carbs: 30, fat: 10, fiber: 2, sugar: 3, sodium: 500 }, emoji: '🥪' },
  'soup': { facts: { calories: 84, protein: 3, carbs: 12, fat: 3, fiber: 2, sugar: 2, sodium: 700 }, emoji: '🍲' },
  'fish': { facts: { calories: 206, protein: 22, carbs: 0, fat: 12, fiber: 0, sugar: 0, sodium: 60 }, emoji: '🐟' },
  'paratha': { facts: { calories: 196, protein: 4, carbs: 26, fat: 8, fiber: 2, sugar: 1, sodium: 298 }, emoji: '🫓' },
  'chole': { facts: { calories: 164, protein: 9, carbs: 27, fat: 3, fiber: 8, sugar: 4, sodium: 380 }, emoji: '🥣' },
  'rajma': { facts: { calories: 140, protein: 9, carbs: 23, fat: 0.5, fiber: 6, sugar: 1, sodium: 330 }, emoji: '🥣' },
  'vegetable curry': { facts: { calories: 140, protein: 4, carbs: 12, fat: 8, fiber: 3, sugar: 4, sodium: 420 }, emoji: '🍛' },
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { foodName, profile } = body as { foodName?: string; profile: UserProfile };

    if (!foodName) {
      return NextResponse.json({ error: 'foodName required' }, { status: 400 });
    }
    if (!profile) {
      return NextResponse.json({ error: 'Profile is required' }, { status: 400 });
    }

    const key = foodName.toLowerCase().trim();
    const match =
      FOOD_DB[key] ||
      Object.entries(FOOD_DB).find(([k]) => key.includes(k) || k.includes(key))?.[1];

    if (!match) {
      const generic: NutritionFacts = {
        calories: 200,
        protein: 8,
        carbs: 25,
        fat: 8,
        fiber: 2,
        sugar: 3,
        sodium: 300,
      };
      const analysis = analyzeFood(foodName, generic, profile, []);
      analysis.emoji = '🍽️';
      analysis.recommendation =
        'Approximate values — not in our database yet. Verify portion size for accuracy.';
      return NextResponse.json({ analysis });
    }

    const analysis = analyzeFood(foodName, match.facts, profile, []);
    analysis.emoji = match.emoji;
    return NextResponse.json({ analysis });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
  }
}
