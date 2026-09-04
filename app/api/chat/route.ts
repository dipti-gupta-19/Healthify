import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { calculateTargets, sumFacts, type LoggedMeal, type UserProfile, type NutritionTargets } from '@/lib/nutrition';
import { geminiTextPlain } from '@/lib/gemini';

// ─── Context summariser ────────────────────────────────────────────────────────

/**
 * Builds a compact, human-readable text block from the user's profile + recent
 * meals. Kept intentionally terse so the Gemini prompt stays small and cheap.
 *
 * Example output (~350 chars for a typical user):
 *
 *   User: Priya, 28F, goal=loss, vegetarian, conditions: diabetes
 *   Targets: 1600 kcal | 80g protein | 200g carbs | 44g fat | 22g fiber
 *
 *   TODAY (Sep 3): 3 meals — 1120/1600 kcal, 52/80g protein
 *     Meals: Oats (breakfast, great) · Dal tadka (lunch, good)
 *
 *   Last 7 days:
 *     Sep 2: 1540 kcal, 72g protein — 4 meal(s)
 *     Sep 1: 1800 kcal, 85g protein — 3 meal(s) (over by 200 kcal)
 */
function buildContextSummary(
  profile: UserProfile,
  targets: NutritionTargets,
  recentMeals: LoggedMeal[],
): string {
  const now = new Date();
  const todayStr = now.toDateString();

  // ── Today ──────────────────────────────────────────────────────────────────
  const todayMeals = recentMeals.filter(
    (m) => new Date(m.loggedAt).toDateString() === todayStr,
  );
  const todayTotals = sumFacts(todayMeals);

  // ── Past days (exclude today) ──────────────────────────────────────────────
  const dayMap = new Map<string, LoggedMeal[]>();
  for (const m of recentMeals) {
    const d = new Date(m.loggedAt).toDateString();
    if (d === todayStr) continue;
    if (!dayMap.has(d)) dayMap.set(d, []);
    dayMap.get(d)!.push(m);
  }

  const lines: string[] = [];

  // Profile header
  const conds =
    (profile.medicalConditions ?? []).filter((c) => c !== 'none').join(', ') ||
    'none';
  const allergiesStr =
    (profile.allergies ?? []).length > 0
      ? `, allergies: ${profile.allergies.join(', ')}`
      : '';
  lines.push(
    `User: ${profile.name}, ${profile.age}${profile.sex === 'male' ? 'M' : 'F'}, ` +
      `goal=${profile.goal}, ${profile.dietType}, conditions: ${conds}${allergiesStr}`,
  );
  lines.push(
    `Targets: ${targets.calories} kcal | ${targets.protein}g protein | ` +
      `${targets.carbs}g carbs | ${targets.fat}g fat | ${targets.fiber}g fiber`,
  );
  lines.push('');

  // Today summary
  const todayLabel = now.toLocaleDateString('en-IN', {
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
    // Show meals newest-last so they read chronologically
    const ordered = [...todayMeals].sort(
      (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
    );
    const mealList = ordered
      .map((m) => `${m.foodName} (${m.mealType}, ${m.verdict})`)
      .join(' · ');
    lines.push(`  Meals: ${mealList}`);
  }

  // Past days (up to 6)
  if (dayMap.size > 0) {
    lines.push('');
    lines.push('Last 7 days:');
    // dayMap keys are in insertion order (newest first since meals sorted desc)
    for (const [, meals] of [...dayMap.entries()].slice(0, 6)) {
      const t = sumFacts(meals);
      const diff = t.calories - targets.calories;
      const diffStr =
        diff > 100
          ? ` (over by ${Math.round(diff)} kcal)`
          : diff < -200
            ? ` (under by ${Math.round(-diff)} kcal)`
            : '';
      const dayLabel = new Date(meals[0].loggedAt).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      });
      lines.push(
        `  ${dayLabel}: ${Math.round(t.calories)} kcal, ` +
          `${Math.round(t.protein)}g protein — ${meals.length} meal(s)${diffStr}`,
      );
    }
  }

  return lines.join('\n');
}

// ─── Route handler ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Healthify's nutrition assistant. The user's meal and profile data is provided below.
Answer in 2–4 short sentences. Use only the data given — don't guess or invent numbers.
Be warm and encouraging. When asked for a habit or tip, suggest exactly one concrete, actionable habit.
Never list more than 2 bullet points. Keep the reply under 80 words.`;

export async function POST(req: Request) {
  try {
    const userId = req.headers.get('x-user-id') || 'demo-user';
    const body = await req.json() as { message?: string; history?: { role: string; text: string }[] };
    const userMessage = (body.message ?? '').trim();
    if (!userMessage) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const db = await getDb();

    // Fetch meals (last 7 days, cap 50) + profile in parallel
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

    // Build prompt
    let contextBlock: string;
    if (!profileDoc) {
      contextBlock = 'No profile found for this user. Meals data may be incomplete.';
    } else {
      const { _id, userId: _uid, updatedAt, ...profileFields } = profileDoc as any;
      const profile = profileFields as UserProfile;
      const targets = calculateTargets(profile);
      contextBlock = buildContextSummary(profile, targets, meals as unknown as LoggedMeal[]);
    }

    // Optionally include last 2 turns for conversational continuity
    const historyBlock =
      Array.isArray(body.history) && body.history.length > 0
        ? '\n\nRecent conversation:\n' +
          body.history
            .slice(-4) // at most last 4 messages = 2 turns
            .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
            .join('\n')
        : '';

    const fullPrompt = [
      SYSTEM_PROMPT,
      '',
      '--- User Data ---',
      contextBlock,
      historyBlock,
      '',
      `User question: ${userMessage}`,
    ].join('\n');

    const result = await geminiTextPlain(fullPrompt);

    if (result.error || !result.text) {
      return NextResponse.json(
        { error: result.error ?? 'No response from AI' },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply: result.text.trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[chat]', msg);
    return NextResponse.json({ error: `Chat failed: ${msg}` }, { status: 500 });
  }
}
