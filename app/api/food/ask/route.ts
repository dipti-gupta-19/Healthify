import { NextResponse } from 'next/server';
import { geminiText } from '@/lib/gemini';
import type { FoodAnalysis, UserProfile } from '@/lib/nutrition';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  food: FoodAnalysis;
  profile?: UserProfile | null;
  question: string;
  history?: ChatMessage[];
}

/**
 * Fast zero-API-cost local relevance guard.
 * Blocks completely off-topic inquiries (e.g. sports, coding, politics, trivia)
 * without consuming Gemini API tokens or quota.
 */
function isFoodOrHealthRelated(question: string, foodName: string): boolean {
  const q = question.toLowerCase().trim();
  const fName = foodName.toLowerCase();

  // Words that indicate an off-topic domain
  const offTopicRegex = /\b(football|soccer|cricket|fifa|ipl|nba|messi|ronaldo|tennis|badminton|hockey|baseball|golf|match score|tournament|champion|world cup|premier league|ballon d'or|nfl|super bowl|python|javascript|typescript|react|html|css|java|c\+\+|bug|github|programming|coding|software|algorithm|database|sql|politics|president|prime minister|election|parliament|biden|trump|modi|senate|congress|war|ukraine|russia|movie|film|actor|actress|hollywood|bollywood|netflix|cinema|song|singer|lyrics|album|capital of|who invented|who discovered|homework|essay|math problem|solve equation|crypto|bitcoin|stock market)\b/i;

  // Words that indicate a nutrition/food/health context
  const foodSignals = /\b(eat|eating|ate|food|foods|drink|drinking|cook|cooking|recipe|snack|snacking|meal|meals|breakfast|lunch|dinner|taste|tasty|chew|bite|consume|consumption|serving|portion|packet|tastemaker|dish|grocery|supermarket|diet|dietary|fasting|calorie|calories|kcal|protein|carb|carbs|carbohydrate|fat|fats|sodium|sugar|sugars|fiber|fibre|salt|oil|vitamin|minerals|nutrient|nutrition|nutritional|macro|macros|weight|gain|loss|lose|muscle|health|healthy|unhealthy|body|bloat|bloating|stomach|gut|digestion|digest|acid|reflux|heart|blood|pressure|bp|glucose|diabetes|diabetic|cholesterol|pcos|allergy|allergies|allergic|safe|safety|danger|toxic|additive|preservative|msg|harmful|beneficial|sleep|night|bedtime|morning|evening|workout|gym|fitness|wellness|instead|alternative|substitute|replace|better|worse|good for|bad for|compare|verdict|recommend|recommendation|ingredients|ingredient|junk food|ultra-processed)\b/i;

  // Check if it explicitly references words from the scanned food name
  const foodWords = fName.split(/[\s,/-]+/).filter((w) => w.length > 2);
  const mentionsFoodName = foodWords.some((w) => q.includes(w));

  // If question matches off-topic keywords and has no food/diet intent signals
  if (offTopicRegex.test(q) && !foodSignals.test(q) && !mentionsFoodName) {
    return false;
  }

  // If question has no food signals, doesn't mention food name, and doesn't use "this" / "it" in food context
  const hasFoodReference = /\b(this|it|that|these)\b/i.test(q);
  if (!foodSignals.test(q) && !mentionsFoodName && !hasFoodReference) {
    return false;
  }

  return true;
}

function generateSmartFallback(
  question: string,
  food: FoodAnalysis,
  profile?: UserProfile | null,
): string {
  const q = question.toLowerCase();
  const f = food.facts;
  const goal = profile?.goal || 'maintain';
  const sodiumPctDaily = Math.round((f.sodium / 2300) * 100);

  // 1. Weight loss / gain question
  if (q.includes('weight') || q.includes('fat') || q.includes('diet') || q.includes('loss') || q.includes('gain')) {
    if (goal === 'loss' || q.includes('loss')) {
      if (f.calories > 300 || f.sodium > 600 || food.isJunkFood || food.verdict === 'poor') {
        return `**Not ideal for weight loss.** 

• **High Calorie Density**: At **${f.calories} kcal** with only **${f.protein}g protein**, it won't keep you full for long and may spike cravings.
• **Water Retention**: The **${f.sodium}mg sodium** (${sodiumPctDaily}% of daily limit) can cause temporary water bloat.
• **Recommendation**: If you eat this, have half a portion and add boiled veggies or a protein source (like tofu or eggs) to balance the glycemic impact.`;
      }
      return `**Yes, in moderation!** 

• **Calorie Friendly**: At **${f.calories} kcal** and **${f.protein}g protein**, it can fit comfortably into your calorie deficit.
• **Tip**: Pair it with drinking plenty of water and fiber-rich greens to stay satiated longer.`;
    }

    if (goal === 'gain' || q.includes('gain')) {
      return `**Decent for energy, but watch protein quality.**

• Provides **${f.calories} kcal** and **${f.carbs}g carbs**, which help hit a caloric surplus.
• However, with only **${f.protein}g protein**, ensure you pair it with a dense protein source (paneer, chicken, lentils, or a shake) to fuel lean muscle growth rather than just fat gain.`;
    }
  }

  // 2. Sodium question
  if (q.includes('sodium') || q.includes('salt') || q.includes('bp') || q.includes('blood pressure')) {
    return `**Why the sodium is high (${f.sodium}mg):**

• **Daily Impact**: This single serving delivers **${sodiumPctDaily}%** of your total recommended daily limit (2,300 mg).
• **Preservation & Flavor**: In packaged foods like **${food.name}**, heavy sodium (table salt, taste enhancers like MSG, and baking agents) is used to intensify seasoning and extend shelf life.
• **Advice**: Drink an extra glass or two of water to help flush out excess sodium, and keep your other meals today naturally low-salt.`;
  }

  // 3. Night / Bedtime eating question
  if (q.includes('night') || q.includes('bed') || q.includes('late') || q.includes('sleep') || q.includes('dinner')) {
    if (f.sodium > 500 || f.carbs > 40 || f.fat > 12) {
      return `**Better to avoid right before bed.**

• **Digestion & Reflux**: High sodium (**${f.sodium}mg**) and fats take longer to digest, which can cause acid reflux, thirst, and restless sleep.
• **Morning Puffiness**: High nighttime sodium causes fluid retention, leaving you feeling bloated when waking up.
• **Better Night Swap**: If you're hungry late, opt for warm milk, a handful of almonds, or a light cucumber-yogurt salad instead.`;
    }
    return `**Acceptable if eaten 2 hours before sleeping.**

• At **${f.calories} kcal**, it is relatively light on digestion. 
• Try to finish eating at least 1.5 to 2 hours before bed so your metabolism can process it comfortably before deep rest.`;
  }

  // 4. Healthy alternative swap question
  if (q.includes('instead') || q.includes('alternative') || q.includes('substitute') || q.includes('replace')) {
    const isNoodleOrSnack = /noodle|pasta|maggi|ramen|chip|snack|cookie|biscuit/i.test(food.name);
    if (isNoodleOrSnack) {
      return `**Healthier alternatives you can enjoy:**

1. **Millet or Whole-Wheat Noodles**: Lower refined carbs, higher fiber (3-4x more), and zero deep-fried oil.
2. **Oats or Vegetable Upma/Poha**: Ready in 10 minutes with natural spices and a fraction of the sodium.
3. **Zucchini or Soba Noodles**: Tossed with a touch of sesame oil, veggies, and your choice of protein for a clean, savory meal.`;
    }
    return `**Great wholesome alternatives:**

1. **Homemade equivalent** made with olive oil or ghee and controlled salt.
2. **Sprouted Moong / Chickpea Chaat** with onions, tomatoes, and lemon for crunch, flavor, and high protein.
3. **Roasted Makhana or Nuts** for an instant nutrient-dense alternative.`;
  }

  // 5. Generic nutrition query fallback
  return `Based on **${food.name}**'s scan:

• **Nutrient Breakdown**: ${f.calories} kcal, ${f.protein}g protein, ${f.carbs}g carbs, ${f.fat}g fat, and ${f.sodium}mg sodium.
• **Overall Verdict**: Rated **${food.verdict.toUpperCase()}** for your health targets.
• **Portion Advice**: ${food.portionAdvice || 'Enjoy occasionally as a treat rather than a daily staple.'}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const { food, profile, question, history = [] } = body;

    if (!food || !question?.trim()) {
      return NextResponse.json({ error: 'Missing food data or question' }, { status: 400 });
    }

    const trimmedQuestion = question.trim();

    // 1. FAST LOCAL GUARD: Check food & nutrition topic relevance
    // Intercepts off-topic queries immediately without spending any API quota!
    if (!isFoodOrHealthRelated(trimmedQuestion, food.name)) {
      return NextResponse.json({
        answer: `I am your Healthify nutrition assistant and can only answer questions related to food, diet, and health! Feel free to ask me anything about **${food.name}** (such as calories, sodium, bedtime digestion, or healthy swaps).`,
        source: 'guardrail',
      });
    }

    // 2. Prepare concise food summary for the prompt
    const foodDetails = [
      `Food: ${food.name} (${food.emoji || '🍽️'})`,
      `Per Serving: ${food.facts?.calories ?? 0} kcal, ${food.facts?.protein ?? 0}g protein, ${food.facts?.carbs ?? 0}g carbs, ${food.facts?.fat ?? 0}g fat, ${food.facts?.sodium ?? 0}mg sodium, ${food.facts?.sugar ?? 0}g sugar`,
      `Verdict: ${food.verdict || 'moderate'}`,
      food.portionAdvice ? `Portion Advice: ${food.portionAdvice}` : null,
      food.harmfulAdditives?.length ? `Harmful Additives: ${food.harmfulAdditives.join(', ')}` : null,
      food.warnings?.length ? `Warnings: ${food.warnings.join('; ')}` : null,
      food.ingredients?.length ? `Key Ingredients: ${food.ingredients.slice(0, 8).join(', ')}` : null,
    ].filter(Boolean).join('\n');

    // Prepare user profile summary (concise)
    const profileDetails = profile ? [
      `User: ${profile.name || 'User'}, Goal: ${profile.goal === 'loss' ? 'Weight Loss' : profile.goal === 'gain' ? 'Muscle Gain' : 'Maintain'}`,
      profile.dietType ? `Diet: ${profile.dietType}` : null,
      profile.medicalConditions?.length && !profile.medicalConditions.includes('none')
        ? `Conditions: ${profile.medicalConditions.join(', ')}`
        : null,
      profile.allergies?.length ? `Allergies: ${profile.allergies.join(', ')}` : null,
    ].filter(Boolean).join(', ') : 'General adult targets';

    // Keep only last 2 turns to minimize token consumption
    const recentHistory = history.slice(-2).map((m) => `${m.role === 'user' ? 'U' : 'AI'}: ${m.content.slice(0, 100)}`).join('\n');

    const prompt = `You are "Healthify AI", a strict clinical dietitian and food analyst for the scanned item "${food.name}".

--- STRICT TOPIC ENFORCEMENT ---
You must ONLY answer questions directly about this food item, nutrition, ingredients, portion advice, diet, or health impacts.
If the question is about ANY OTHER TOPIC (e.g. football, cricket, sports scores, politics, movies, programming, general trivia, homework), refuse concisely in one sentence:
"I can only answer questions related to food, nutrition, and your health goals. Please ask me about ${food.name} or your dietary targets!"

--- CONTEXT ---
${foodDetails}
Profile: ${profileDetails}
${recentHistory ? `Prior: ${recentHistory}\n` : ''}
Question: ${trimmedQuestion}

--- RULES ---
1. Give a direct, accurate answer using the scanned numbers (${food.facts?.sodium ?? 0}mg sodium, ${food.facts?.calories ?? 0} kcal, etc.) and user goal.
2. Max 2 concise bullet points or 80 words.
3. Be helpful, professional, and practical.`;

    // Attempt Gemini response with prompt instructions controlling concise length
    const { text, error } = await geminiText(prompt, {
      maxOutputTokens: 600,
    });

    if (text && text.trim().length > 0) {
      return NextResponse.json({ answer: text.trim(), source: 'gemini' });
    }

    // Fallback response if Gemini hits quota or network issue
    const fallbackAnswer = generateSmartFallback(trimmedQuestion, food, profile);
    return NextResponse.json({ answer: fallbackAnswer, source: 'fallback', note: error || undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to answer question: ${msg}` }, { status: 500 });
  }
}
