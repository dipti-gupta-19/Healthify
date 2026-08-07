import type { NutritionFacts } from './nutrition';

export const FOOD_DB: Record<string, { facts: NutritionFacts; emoji: string }> = {
  'roti': { facts: { calories: 120, protein: 3.1, carbs: 18, fat: 3.7, fiber: 2.7, sugar: 0.5, sodium: 134 }, emoji: '🫓' },
  'dal': { facts: { calories: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sugar: 2, sodium: 240 }, emoji: '🥣' },
  'rice': { facts: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 1 }, emoji: '🍚' },
  'chicken curry': { facts: { calories: 253, protein: 21, carbs: 4, fat: 18, fiber: 1, sugar: 1, sodium: 580 }, emoji: '🍛' },
  'chicken biryani': { facts: { calories: 202, protein: 12, carbs: 27, fat: 6, fiber: 1.5, sugar: 1, sodium: 350 }, emoji: '🍚' },
  'paneer': { facts: { calories: 265, protein: 18, carbs: 1.2, fat: 20, fiber: 0, sugar: 1.2, sodium: 300 }, emoji: '🧀' },
  'paneer curry': { facts: { calories: 220, protein: 14, carbs: 8, fat: 16, fiber: 2, sugar: 3, sodium: 450 }, emoji: '🍛' },
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
  'thali': { facts: { calories: 450, protein: 18, carbs: 55, fat: 18, fiber: 8, sugar: 6, sodium: 680 }, emoji: '🍽️' },
  'indian thali': { facts: { calories: 450, protein: 18, carbs: 55, fat: 18, fiber: 8, sugar: 6, sodium: 680 }, emoji: '🍽️' },
  'curry': { facts: { calories: 180, protein: 8, carbs: 12, fat: 12, fiber: 3, sugar: 3, sodium: 480 }, emoji: '🍛' },
  'fried rice': { facts: { calories: 238, protein: 5, carbs: 38, fat: 7, fiber: 1.5, sugar: 1, sodium: 520 }, emoji: '🍚' },
  'tandoori chicken': { facts: { calories: 165, protein: 27, carbs: 2, fat: 5, fiber: 0, sugar: 1, sodium: 380 }, emoji: '🍗' },
  'naan': { facts: { calories: 262, protein: 8, carbs: 45, fat: 5, fiber: 2, sugar: 2, sodium: 418 }, emoji: '🫓' },
  'lassi': { facts: { calories: 120, protein: 4, carbs: 18, fat: 3, fiber: 0, sugar: 15, sodium: 80 }, emoji: '🥛' },
  'chai': { facts: { calories: 60, protein: 2, carbs: 8, fat: 2, fiber: 0, sugar: 6, sodium: 40 }, emoji: '☕' },
  'chips': { facts: { calories: 536, protein: 7, carbs: 53, fat: 35, fiber: 4, sugar: 0.5, sodium: 480 }, emoji: '🥔' },
  'potato crisps': { facts: { calories: 536, protein: 7, carbs: 53, fat: 35, fiber: 4, sugar: 0.5, sodium: 480 }, emoji: '🥔' },
  'lays': { facts: { calories: 536, protein: 7, carbs: 53, fat: 35, fiber: 4, sugar: 0.5, sodium: 480 }, emoji: '🥔' },
};

export const FOOD_KEYS = Object.keys(FOOD_DB).sort((a, b) => b.length - a.length);

export function matchFoodFromText(text: string, keys = FOOD_KEYS): string | null {
  const lower = text.toLowerCase();
  for (const key of keys) {
    if (lower.includes(key)) return key;
  }
  for (const key of keys) {
    const words = key.split(' ');
    if (words.length > 1 && words.every((w) => lower.includes(w))) return key;
  }
  return null;
}

export function findAllFoodMatches(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const key of FOOD_KEYS) {
    if (lower.includes(key)) found.add(key);
  }
  return Array.from(found);
}

export function findFoodMatch(query: string): { key: string; entry: typeof FOOD_DB[string] } | null {
  const key = query.toLowerCase().trim();
  if (FOOD_DB[key]) return { key, entry: FOOD_DB[key] };

  const matchedKey = matchFoodFromText(key);
  if (matchedKey) return { key: matchedKey, entry: FOOD_DB[matchedKey] };

  const partial = Object.entries(FOOD_DB).find(([k]) => key.includes(k) || k.includes(key));
  if (partial) return { key: partial[0], entry: partial[1] };

  return null;
}

export function combineFoodNutrition(keys: string[]): { facts: NutritionFacts; emoji: string; name: string } {
  if (keys.length === 0) {
    return {
      facts: { calories: 200, protein: 8, carbs: 25, fat: 8, fiber: 2, sugar: 3, sodium: 300 },
      emoji: '🍽️',
      name: 'mixed meal',
    };
  }
  if (keys.includes('thali') || keys.includes('indian thali') || keys.length >= 3) {
    const thali = FOOD_DB['thali'];
    return { facts: thali.facts, emoji: thali.emoji, name: keys.length >= 3 ? 'indian thali' : keys[0] };
  }
  const facts: NutritionFacts = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
  let emoji = '🍽️';
  for (const k of keys) {
    const entry = FOOD_DB[k];
    if (!entry) continue;
    facts.calories += entry.facts.calories;
    facts.protein += entry.facts.protein;
    facts.carbs += entry.facts.carbs;
    facts.fat += entry.facts.fat;
    facts.fiber += entry.facts.fiber;
    facts.sugar += entry.facts.sugar;
    facts.sodium += entry.facts.sodium;
    emoji = entry.emoji;
  }
  return { facts, emoji, name: keys.join(' + ') };
}

export function extractProductNameFromLabel(text: string): string | null {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('ingredient')) continue;
    if (lower.includes('nutrition')) continue;
    if (lower.includes('serving')) continue;
    if (line.length < 3 || line.length > 80) continue;
    if (/^\d+$/.test(line)) continue;
    return line;
  }
  const beforeIngredients = text.split(/ingredients/i)[0]?.trim();
  if (beforeIngredients && beforeIngredients.length > 2 && beforeIngredients.length < 80) {
    const lastLine = beforeIngredients.split('\n').pop()?.trim();
    if (lastLine) return lastLine;
  }
  return null;
}
