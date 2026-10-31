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

const SYSTEM_PROMPT = `You are Healthify's dedicated Nutrition & Food Advisor.
Your role is to act as a warm, knowledgeable personal nutritionist answering questions about the user's specific logged meals, scanned foods, nutrition targets, health status, recipes, and dietary goals.

STRICT INSTRUCTIONS:
1. SCANNED FOOD CONTEXT (CRITICAL): When an ACTIVE SCANNED FOOD is provided in the prompt, the user is actively viewing that exact food right now on their screen.
   - All questions like "what is a healthier alternative?", "can I eat this?", "is this good for me?", or "how much sugar?" refer directly to this scanned food.
   - NEVER ask "which food do you want to replace?" or "what food are you asking about?". You ALREADY know the food.
   - When asked for a healthier alternative, immediately recommend 2 to 3 specific, realistic, and delicious healthier alternatives with brief nutritional reasons (e.g., lower sodium, no palm oil, more fiber or protein).
2. USER PROFILE DATA: Use the user's profile, medical conditions (e.g. diabetes, hypertension), and daily targets to give personalized, safe advice.
3. CONCISE & HELPFUL: Keep your response friendly, clear, and direct (in 2-4 sentences). Do not repeat long disclaimers.
4. NON-FOOD QUESTIONS: If the user asks non-food queries, politely remind them you specialize exclusively in food, nutrition, and meal safety.`;

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

    let dbMeals: any[] = [];
    let profileDoc: any = null;

    if (process.env.MONGODB_URI) {
      try {
        const db = await getDb();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        [dbMeals, profileDoc] = await Promise.all([
          db
            .collection('meals')
            .find({ userId, loggedAt: { $gte: sevenDaysAgo.toISOString() } })
            .sort({ loggedAt: -1 })
            .limit(50)
            .toArray(),
          db.collection('profiles').findOne({ userId }),
        ]);
      } catch (dbErr) {
        console.warn('MongoDB query bypassed in chat:', dbErr);
      }
    }

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

    // BUILD ACTIVE SCANNED FOOD BLOCK IF PRESENT
    let scannedFoodBlock = '';
    if (body.foodContext && body.foodContext.name) {
      const fc = body.foodContext;
      const ingredientsStr = Array.isArray(fc.ingredients) ? fc.ingredients.join(', ') : (fc.ingredients || 'Not listed');
      const warningsStr = Array.isArray(fc.warnings) ? fc.warnings.join('; ') : (fc.warnings || 'None');
      const whyLimitStr = Array.isArray(fc.whyLimit) ? fc.whyLimit.join('; ') : (fc.whyLimit || fc.junkFoodLabel || 'None');
      const alertsStr = Array.isArray(fc.dietAlerts) ? fc.dietAlerts.map((d: any) => d.message || d.label).join(', ') : 'None';

      scannedFoodBlock = [
        '',
        '--- ACTIVE SCANNED FOOD (CURRENTLY BEING VIEWED) ---',
        `Food Item: "${fc.name}"`,
        `Per Serving: ${fc.calories} kcal | Protein: ${fc.protein}g | Carbs: ${fc.carbs}g | Fat: ${fc.fat}g | Sugar: ${fc.sugar ?? 0}g | Sodium: ${fc.sodium ?? 0}mg | Fiber: ${fc.fiber ?? 0}g`,
        `Health Rating: ${fc.verdict || 'moderate'}`,
        `Key Ingredients: ${ingredientsStr}`,
        `Warnings & Additives: ${warningsStr}`,
        `Concerns / Why Limit: ${whyLimitStr}`,
        `Portion Advice: ${fc.portionAdvice || 'Standard portion'}`,
        `Dietary Alerts: ${alertsStr}`,
        '',
        `RULE: The user is asking directly about "${fc.name}". If they ask for an alternative, NEVER ask "which food do you want to replace?". Recommend 2-3 specific, realistic healthier alternatives for "${fc.name}" right away!`,
        '--------------------------------------------------',
      ].join('\n');
    }

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
      scannedFoodBlock,
      '--- User Real-Time Data & Health Context ---',
      contextBlock,
      historyBlock,
      '',
      `User Question: ${userMessage}`,
    ].filter(Boolean).join('\n');

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

    // 1. SCANNED FOOD SPECIFIC SMART FALLBACKS
    if (body.foodContext && body.foodContext.name) {
      const fc = body.foodContext;
      const fName = fc.name;
      const lowerName = fName.toLowerCase();

      if (
        lowerQ.includes('alternative') ||
        lowerQ.includes('replace') ||
        lowerQ.includes('substitute') ||
        lowerQ.includes('healthy option') ||
        lowerQ.includes('healthier') ||
        lowerQ.includes('swap')
      ) {
        if (
          lowerName.includes('monaco') ||
          lowerName.includes('cracker') ||
          lowerName.includes('biscuit') ||
          lowerName.includes('chips') ||
          lowerName.includes('wafer') ||
          lowerName.includes('crisp') ||
          lowerName.includes('namkeen') ||
          lowerName.includes('snack')
        ) {
          return NextResponse.json({
            reply: `Here are 3 healthier alternatives to "${fName}":\n1. **Roasted Makhana (Foxnuts)** — seasoned with rock salt and black pepper; gives identical savory crunch with 70% less sodium and zero refined flour.\n2. **Baked Multigrain or Ragi Khakhra** — rich in complex fibers and minerals without palm oil or transfats.\n3. **Roasted Pumpkin & Sunflower Seeds** — provides healthy omega fats, protein, and crunch without blood sugar spikes.`,
          });
        }

        if (
          lowerName.includes('soda') ||
          lowerName.includes('cola') ||
          lowerName.includes('juice') ||
          lowerName.includes('drink') ||
          lowerName.includes('shake')
        ) {
          return NextResponse.json({
            reply: `Instead of "${fName}", great healthier swaps include: 1) Fresh tender coconut water with mint; 2) Unsweetened iced lemon green tea; 3) Chia-infused water with lime for hydration and omega-3s with minimal sugar.`,
          });
        }

        if (
          lowerName.includes('sweet') ||
          lowerName.includes('chocolate') ||
          lowerName.includes('candy') ||
          lowerName.includes('cake') ||
          lowerName.includes('cookie')
        ) {
          return NextResponse.json({
            reply: `For a healthier sweet alternative to "${fName}": 1) Medjool dates stuffed with raw almonds; 2) Greek yogurt topped with fresh berries and cinnamon; 3) 85%+ dark chocolate squares for high antioxidants without blood sugar spikes.`,
          });
        }

        if (
          lowerName.includes('noodle') ||
          lowerName.includes('maggi') ||
          lowerName.includes('pasta') ||
          lowerName.includes('ramen')
        ) {
          return NextResponse.json({
            reply: `Healthier swaps for "${fName}": 1) Foxtail millet or whole wheat noodles tossed with colorful stir-fried vegetables; 2) Zucchini spirals (zoodles) with garlic and paneer/tofu; 3) Masala rolled oats with steamed sprouts.`,
          });
        }

        return NextResponse.json({
          reply: `Healthier alternatives to "${fName}" include whole-food options like roasted edamame, roasted spiced chickpeas (chana), or sprouted moong salad. These provide more dietary fiber, lower sodium, and sustained energy without ultra-processed additives.`,
        });
      }

      if (lowerQ.includes('sugar')) {
        return NextResponse.json({
          reply: `"${fName}" contains approximately ${fc.sugar ?? 0}g of sugar per serving. For your ${activeProfile.dietType} diet and daily sugar limit (${targets.sugarMax}g), ${Number(fc.sugar) > 10 ? 'this is relatively high so enjoy in strict moderation.' : 'this fits within your daily threshold.'}`,
        });
      }

      if (lowerQ.includes('protein')) {
        return NextResponse.json({
          reply: `"${fName}" provides ${fc.protein}g of protein per serving (${Math.round((fc.protein / targets.protein) * 100)}% of your ${targets.protein}g daily protein target). Consider pairing it with Greek yogurt, boiled sprouts, or roasted paneer to boost protein intake.`,
        });
      }

      if (lowerQ.includes('safe') || lowerQ.includes('healthy') || lowerQ.includes('good') || lowerQ.includes('verdict')) {
        const warningSnippet = Array.isArray(fc.warnings) && fc.warnings.length > 0 ? ` Note: ${fc.warnings[0]}.` : '';
        return NextResponse.json({
          reply: `"${fName}" has an overall health verdict of "${fc.verdict}". It packs ${fc.calories} kcal, ${fc.sugar ?? 0}g sugar, and ${fc.sodium ?? 0}mg sodium.${warningSnippet} Keep portions mindful to stay aligned with your health targets.`,
        });
      }

      if (lowerQ.includes('calorie') || lowerQ.includes('portion') || lowerQ.includes('fit') || lowerQ.includes('budget')) {
        return NextResponse.json({
          reply: `"${fName}" provides ${fc.calories} kcal per serving (${Math.round((fc.calories / targets.calories) * 100)}% of your daily ${targets.calories} kcal target). ${fc.portionAdvice ? `Advice: ${fc.portionAdvice}` : 'Enjoy in moderation to stay on track!'}`,
        });
      }
    }

    // 2. GENERAL PROFILE & LOGGED MEALS SMART FALLBACKS
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
