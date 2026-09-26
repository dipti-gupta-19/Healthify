import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { calculateTargets, sumFacts, type LoggedMeal, type UserProfile, type NutritionTargets } from '@/lib/nutrition';
import { geminiTextPlain } from '@/lib/gemini';
import { getUserFromRequest } from '@/lib/auth';

function buildContextSummary(
  profile: UserProfile,
  targets: NutritionTargets,
  recentMeals: LoggedMeal[],
): string {
  const now = new Date();
  const todayStr = now.toDateString();

  const todayMeals = recentMeals.filter(
    (m) => new Date(m.loggedAt).toDateString() === todayStr,
  );
  const todayTotals = sumFacts(todayMeals);

  const dayMap = new Map<string, LoggedMeal[]>();
  for (const m of recentMeals) {
    const d = new Date(m.loggedAt).toDateString();
    if (d === todayStr) continue;
    if (!dayMap.has(d)) dayMap.set(d, []);
    dayMap.get(d)!.push(m);
  }

  const lines: string[] = [];

  const conds =
    (profile.medicalConditions ?? []).filter((c) => c !== 'none').join(', ') ||
    'none';
  const allergiesStr =
    (profile.allergies ?? []).length > 0
      ? `, allergies: ${profile.allergies.join(', ')}`
      : '';
  lines.push(
    `User Profile: ${profile.name}, ${profile.age}${profile.sex === 'male' ? 'M' : 'F'}, ` +
      `goal=${profile.goal}, diet=${profile.dietType}, medical conditions: ${conds}${allergiesStr}`,
  );
  lines.push(
    `Daily Targets: ${targets.calories} kcal | ${targets.protein}g protein | ` +
      `${targets.carbs}g carbs | ${targets.fat}g fat | ${targets.fiber}g fiber | sugar max ${targets.sugarMax}g`,
  );
  lines.push('');

  const todayLabel = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  lines.push(
    `TODAY (${todayLabel}): ${todayMeals.length} meal(s) logged — ` +
      `${Math.round(todayTotals.calories)}/${targets.calories} kcal, ` +
      `${Math.round(todayTotals.protein)}/${targets.protein}g protein, ` +
      `${Math.round(todayTotals.carbs)}/${targets.carbs}g carbs`,
  );
  if (todayMeals.length > 0) {
    const ordered = [...todayMeals].sort(
      (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
    );
    const mealList = ordered
      .map((m) => `${m.foodName} (${m.mealType}, ${m.verdict})`)
      .join(' · ');
    lines.push(`  Meals today: ${mealList}`);
  }

  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are Healthify's dedicated AI Nutrition & Food Assistant.
Your sole role and domain of expertise is food, nutrition, ingredients, recipes, calories, macros, meal safety, health profiles, and dietary goals.

STRICT INSTRUCTIONS:
1. FOOD-RELATED QUESTIONS: If the user's question is related to food, nutrition, ingredients, recipes, calories, meal timing, dietary safety, or health goals, answer their question directly, accurately, helpfully, and concisely (in 2-4 clear sentences).
2. NON-FOOD QUESTIONS: If the user asks a question that is NOT related to food, nutrition, ingredients, or diet (for example: coding, sports, general trivia, movies, math, non-food chat), DO NOT answer the non-food query. Instead, politely reply:
"I am Healthify's AI Nutrition Assistant, specialized exclusively in food, nutrition, ingredients, meal safety, and health goals. Please ask me any questions about food, meals, or your diet!"`;

export async function POST(req: Request) {
  try {
    const session = await getUserFromRequest(req);
    const userId = session?.userId || req.headers.get('x-user-id') || 'demo-user';

    const body = await req.json() as {
      message?: string;
      messages?: { role: string; content?: string; text?: string }[];
      history?: { role: string; text: string }[];
      profile?: UserProfile;
      foodContext?: any;
    };

    // Extract user question from message string or messages array
    let userMessage = (body.message ?? '').trim();

    if (!userMessage && Array.isArray(body.messages) && body.messages.length > 0) {
      const last = body.messages[body.messages.length - 1];
      userMessage = (last.content || last.text || '').trim();
    }

    if (!userMessage) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const db = await getDb();

    // Fetch user meals & profile
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [meals, profileDoc] = await Promise.all([
      db
        .collection('meals')
        .find({ userId, loggedAt: { $gte: sevenDaysAgo.toISOString() } })
        .sort({ loggedAt: -1 })
        .limit(50)
        .toArray(),
      db.collection('profiles').findOne({ userId }),
    ]);

    const activeProfile: UserProfile = body.profile || (profileDoc as any) || {
      name: 'User',
      age: 25,
      sex: 'male',
      weightKg: 70,
      heightCm: 170,
      activityLevel: 'moderate',
      goal: 'maintain',
      dietType: 'vegetarian',
      medicalConditions: [],
      allergies: [],
    };

    const targets = calculateTargets(activeProfile);
    const contextBlock = buildContextSummary(activeProfile, targets, meals as unknown as LoggedMeal[]);

    const historyBlock =
      Array.isArray(body.history) && body.history.length > 0
        ? '\n\nRecent conversation:\n' +
          body.history
            .slice(-4)
            .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
            .join('\n')
        : Array.isArray(body.messages) && body.messages.length > 1
        ? '\n\nRecent messages:\n' +
          body.messages
            .slice(-5, -1)
            .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content || m.text}`)
            .join('\n')
        : '';

    const foodContextBlock = body.foodContext
      ? `\nCurrent Scanned Food Details: ${JSON.stringify(body.foodContext)}`
      : '';

    const fullPrompt = [
      SYSTEM_PROMPT,
      '',
      '--- User Data & Context ---',
      contextBlock,
      foodContextBlock,
      historyBlock,
      '',
      `User Question: ${userMessage}`,
    ].join('\n');

    const result = await geminiTextPlain(fullPrompt);

    if (result.error || !result.text) {
      // Fallback text if API quota or key issue
      return NextResponse.json({
        reply: `I am Healthify's AI Nutrition Assistant, specialized exclusively in food, nutrition, ingredients, and health goals. Regarding your question about food: Please check your meal's nutrition targets on your dashboard!`,
      });
    }

    return NextResponse.json({ reply: result.text.trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[chat]', msg);
    return NextResponse.json({ error: `Chat failed: ${msg}` }, { status: 500 });
  }
}
