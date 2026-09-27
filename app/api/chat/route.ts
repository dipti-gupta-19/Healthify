import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { calculateTargets, sumFacts, type LoggedMeal, type UserProfile, type NutritionTargets } from '@/lib/nutrition';
import { geminiTextPlain } from '@/lib/gemini';
import { getUserFromRequest } from '@/lib/auth';
import { getHealthAdvice, type HealthCondition } from '@/lib/health-checkin';

function buildContextSummary(
  profile: UserProfile,
  targets: NutritionTargets,
  recentMeals: LoggedMeal[],
  healthCondition: HealthCondition = 'healthy',
  customSymptoms?: string
): string {
  const now = new Date();
  const todayStr = now.toDateString();

  const todayMeals = recentMeals.filter(
    (m) => new Date(m.loggedAt).toDateString() === todayStr,
  );
  const todayTotals = sumFacts(todayMeals);

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
      `goal=${profile.goal}, diet=${profile.dietType}, medical conditions: ${conds}${allergiesStr}`
  );
  lines.push(
    `Daily Targets: ${targets.calories} kcal | ${targets.protein}g protein | ` +
      `${targets.carbs}g carbs | ${targets.fat}g fat | ${targets.fiber}g fiber | sugar max ${targets.sugarMax}g`
  );

  const advice = getHealthAdvice(healthCondition);
  lines.push(
    `Today Health Status: ${customSymptoms ? customSymptoms : advice.title} (${advice.badge})`
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
      `${Math.round(todayTotals.carbs)}/${targets.carbs}g carbs, ` +
      `${Math.round(todayTotals.fat)}/${targets.fat}g fat`
  );
  if (todayMeals.length > 0) {
    const ordered = [...todayMeals].sort(
      (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
    );
    const mealList = ordered
      .map(
        (m) =>
          `${m.foodName} (${m.mealType}, ${m.facts.calories} kcal, ${m.facts.protein}g protein${
            m.healthValidation ? `, verdict: ${m.healthValidation.statusBadge}` : ''
          })`
      )
      .join(' · ');
    lines.push(`  Meals today: ${mealList}`);
  } else {
    lines.push(`  No meals logged today yet.`);
  }

  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are Healthify's dedicated AI Nutrition & Food Assistant.
Your role is to act as a warm, knowledgeable personal nutritionist answering questions about the user's specific logged meals, nutrition targets, health status, recipes, and dietary goals.

STRICT INSTRUCTIONS:
1. USER SPECIFIC DATA: Use the user's profile, today's logged meals, protein targets, and today's health condition (e.g. sore throat, fever, stomach upset) to give specific, personalized, warm, and helpful answers.
2. CONCISE & HELPFUL: Keep your response friendly, clear, and direct (in 2-4 sentences).
3. NON-FOOD QUESTIONS: If the user asks non-food queries (coding, math, sports, general trivia), politely remind them you specialize exclusively in food, nutrition, and meal safety.`;

export async function POST(req: Request) {
  try {
    const session = await getUserFromRequest(req);
    const userId = session?.userId || req.headers.get('x-user-id') || 'demo-user';

    const body = (await req.json()) as {
      message?: string;
      messages?: { role: string; content?: string; text?: string }[];
      history?: { role: string; text: string }[];
      profile?: UserProfile;
      localMeals?: LoggedMeal[];
      healthCondition?: HealthCondition;
      customSymptoms?: string;
      foodContext?: any;
    };

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
    const [dbMeals, profileDoc] = await Promise.all([
      db
        .collection('meals')
        .find({ userId, loggedAt: { $gte: sevenDaysAgo.toISOString() } })
        .sort({ loggedAt: -1 })
        .limit(50)
        .toArray(),
      db.collection('profiles').findOne({ userId }),
    ]);

    const clientMeals = Array.isArray(body.localMeals) ? body.localMeals : [];
    const allMealsMap = new Map<string, LoggedMeal>();

    for (const m of [...(dbMeals as unknown as LoggedMeal[]), ...clientMeals]) {
      const key = `${m.foodName}-${m.loggedAt}`;
      if (!allMealsMap.has(key)) allMealsMap.set(key, m);
    }
    const combinedMeals = Array.from(allMealsMap.values());

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
    const contextBlock = buildContextSummary(
      activeProfile,
      targets,
      combinedMeals,
      body.healthCondition || 'healthy',
      body.customSymptoms
    );

    const historyBlock =
      Array.isArray(body.history) && body.history.length > 0
        ? '\n\nRecent conversation:\n' +
          body.history
            .slice(-4)
            .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
            .join('\n')
        : '';

    const fullPrompt = [
      SYSTEM_PROMPT,
      '',
      '--- User Real-Time Data & Health Context ---',
      contextBlock,
      historyBlock,
      '',
      `User Question: ${userMessage}`,
    ].join('\n');

    // Attempt Gemini call
    const result = await geminiTextPlain(fullPrompt);

    if (result.text && result.text.trim()) {
      return NextResponse.json({ reply: result.text.trim() });
    }

    // INTELLIGENT CONTEXTUAL SMART FALLBACK
    const lowerQ = userMessage.toLowerCase();
    const todayStr = new Date().toDateString();
    const todayMeals = combinedMeals.filter((m) => new Date(m.loggedAt).toDateString() === todayStr);
    const todayTotals = sumFacts(todayMeals);

    if (lowerQ.includes('food history') || lowerQ.includes('eat today') || lowerQ.includes('what did i eat')) {
      if (todayMeals.length === 0) {
        return NextResponse.json({
          reply: `You haven't logged any meals today yet! Scan packaged food or snap a photo of your dish to track your live budget.`,
        });
      }
      const mealNames = todayMeals.map((m) => `${m.foodName} (${m.facts.calories} kcal, ${m.facts.protein}g protein)`).join(', ');
      return NextResponse.json({
        reply: `Today you have logged ${todayMeals.length} meal(s): ${mealNames}. Total consumed: ${todayTotals.calories} / ${targets.calories} kcal and ${todayTotals.protein} / ${targets.protein}g protein.`,
      });
    }

    if (lowerQ.includes('protein') || lowerQ.includes('goal')) {
      const remainingProt = Math.max(0, targets.protein - todayTotals.protein);
      return NextResponse.json({
        reply: `You've consumed ${todayTotals.protein}g out of your ${targets.protein}g daily protein target (${Math.round((todayTotals.protein / targets.protein) * 100)}% complete). You need ${remainingProt}g more protein today!`,
      });
    }

    if (lowerQ.includes('sore throat') || lowerQ.includes('fever') || lowerQ.includes('cough') || lowerQ.includes('stomach') || lowerQ.includes('recovery')) {
      const cond = body.healthCondition || 'cough';
      const advice = getHealthAdvice(cond);
      const foods = advice.recommendedFoods.map((f) => f.name).join(', ');
      return NextResponse.json({
        reply: `For ${advice.title} recovery: We recommend warm, soft foods like ${foods}. Avoid chilled beverages, deep fried foods, and heavy spices today!`,
      });
    }

    return NextResponse.json({
      reply: `Based on your profile (${activeProfile.name}, goal: ${activeProfile.goal}): You have consumed ${todayTotals.calories} of ${targets.calories} kcal today. Let me know if you'd like meal recommendations or nutrition tips! 🥗`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[chat]', msg);
    return NextResponse.json({ error: `Chat failed: ${msg}` }, { status: 500 });
  }
}
