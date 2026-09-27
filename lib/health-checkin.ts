export type HealthCondition = 'healthy' | 'fever' | 'cough' | 'stomach_upset' | 'sore_throat' | 'fatigue';

export interface DailyHealthCheckin {
  date: string; // YYYY-MM-DD
  condition: HealthCondition;
  customSymptoms?: string;
  note?: string;
}

export interface HealthAdvice {
  condition: HealthCondition;
  title: string;
  badge: string;
  color: string;
  description: string;
  recommendedFoods: { name: string; emoji: string; desc: string; veg: boolean }[];
  avoidFoods: string[];
  tips: string[];
}

const HEALTH_ADVICE_DATABASE: Record<HealthCondition, HealthAdvice> = {
  healthy: {
    condition: 'healthy',
    title: 'Feeling Great & Fit',
    badge: 'Optimal Health',
    color: 'emerald',
    description: 'Your body is in good condition. Maintain balanced macros tailored to your fitness goals.',
    recommendedFoods: [
      { name: 'Grilled Protein & Quinoa Bowl', emoji: '🥗', desc: 'Balanced amino acids and complex carbs', veg: true },
      { name: 'Mixed Berry & Greek Yogurt Parfait', emoji: '🫐', desc: 'Probiotics and antioxidants for endurance', veg: true },
      { name: 'Lean Chicken Breast or Paneer Tikka', emoji: '🍗', desc: 'High protein for muscle synthesis', veg: false },
    ],
    avoidFoods: ['Processed junk snacks', 'Excessive refined sugar', 'Trans-fat heavy fried foods'],
    tips: ['Drink at least 2.5 - 3 Liters of water today.', 'Maintain high protein intake post workout.'],
  },
  fever: {
    condition: 'fever',
    title: 'Fever / High Temperature',
    badge: 'Light & Warm Diet Required',
    color: 'rose',
    description: 'Your body is fighting an infection. Stick to easily digestible, hydration-rich, soothing foods.',
    recommendedFoods: [
      { name: 'Moong Dal Khichdi', emoji: '🍲', desc: 'Easy on stomach, rich in soft protein and light carbs', veg: true },
      { name: 'Warm Vegetable/Chicken Clear Broth', emoji: '🥣', desc: 'Replenishes lost electrolytes and fluids', veg: true },
      { name: 'Tender Coconut Water', emoji: '🥥', desc: 'Natural hydration with essential potassium', veg: true },
      { name: 'Steamed Carrots & Applesauce', emoji: '🍎', desc: 'Gentle on gut and easy to digest', veg: true },
    ],
    avoidFoods: ['Heavy oily fried foods', 'Spicy curry', 'Cold drinks or ice cream', 'Heavy meats & dairy cream'],
    tips: [
      'Drink warm water or herbal infusion frequently to prevent dehydration.',
      'Eat small, frequent light meals instead of heavy dinners.',
    ],
  },
  cough: {
    condition: 'cough',
    title: 'Cough, Cold & Congestion',
    badge: 'Soothing & Anti-Inflammatory',
    color: 'amber',
    description: 'Focus on warm liquids, natural decongestants, and anti-inflammatory spices like turmeric and ginger.',
    recommendedFoods: [
      { name: 'Hot Turmeric & Ginger Latte', emoji: '☕', desc: 'Natural curcumin and gingerol for throat relief', veg: true },
      { name: 'Garlic Pepper Soup', emoji: '🍲', desc: 'Antimicrobial and immune-boosting clear soup', veg: true },
      { name: 'Steamed Veggies with Black Pepper', emoji: '🥦', desc: 'Rich in Vitamin C without aggravating throat', veg: true },
      { name: 'Honey Lemon Warm Water', emoji: '🍯', desc: 'Coats and calms irritated vocal mucosa', veg: true },
    ],
    avoidFoods: ['Chilled beverages', 'Excessive dairy (may increase mucus)', 'Crispy/hard dry chips', 'Deep fried food'],
    tips: [
      'Sip warm water throughout the day.',
      'Steam inhalation before sleep helps clear airways.',
    ],
  },
  stomach_upset: {
    condition: 'stomach_upset',
    title: 'Stomach Upset / Acidity / Nausea',
    badge: 'BRAT & Gut Restoration',
    color: 'purple',
    description: 'Your gastrointestinal tract needs rest. Consume low-fiber, bland, easy-to-absorb foods.',
    recommendedFoods: [
      { name: 'Curd Rice with Cumin', emoji: '🍚', desc: 'Probiotic curd soothes lining and calms stomach', veg: true },
      { name: 'Banana & Oatmeal Porridge', emoji: '🍌', desc: 'Pectin-rich, soothing and non-irritating', veg: true },
      { name: 'Plain Dry Toast', emoji: '🍞', desc: 'Absorbs excess gastric juices without acidity', veg: true },
      { name: 'Warm Chamomile / Peppermint Tea', emoji: '🍵', desc: 'Relaxes smooth gastrointestinal muscles', veg: true },
    ],
    avoidFoods: ['Citrus fruits', 'Raw salads & high fiber raw greens', 'Spicy chilies & garlic', 'Caffeinated coffee'],
    tips: ['Eat slowly and stay upright for 30 mins after eating.', 'Avoid carbonated drinks.'],
  },
  sore_throat: {
    condition: 'sore_throat',
    title: 'Sore Throat & Swallowing Pain',
    badge: 'Soft & Liquid Nutrition',
    color: 'orange',
    description: 'Stick to smooth, warm, non-acidic foods that glide down easily without irritating your throat.',
    recommendedFoods: [
      { name: 'Mashed Potatoes / Soft Pumpkin Purée', emoji: '🥔', desc: 'Smooth texture, rich in Vitamin A', veg: true },
      { name: 'Warm Oats Porridge with Honey', emoji: '🥣', desc: 'Nourishing, soft and soothing', veg: true },
      { name: 'Warm Herbal Infusion with Tulsi', emoji: '🫖', desc: 'Reduces pharyngeal inflammation', veg: true },
    ],
    avoidFoods: ['Acidic tomatoes & lemons', 'Hard crunchy biscuits & nuts', 'Spicy peppers', 'Extremely hot soup'],
    tips: ['Gargle with warm salt water 3 times daily.', 'Keep room humidified.'],
  },
  fatigue: {
    condition: 'fatigue',
    title: 'Fatigue & Low Energy',
    badge: 'Iron & Complex Energy Boost',
    color: 'sky',
    description: 'Boost your energy with iron-rich foods, B-vitamins, complex slow-release carbohydrates, and hydration.',
    recommendedFoods: [
      { name: 'Spinach & Lentil Soup (Dal Palak)', emoji: '🥘', desc: 'Rich in Iron, Folate, and Plant Protein', veg: true },
      { name: 'Handful of Roasted Almonds & Dates', emoji: '🥜', desc: 'Natural magnesium and sustained glucose', veg: true },
      { name: 'Chia Seed Banana Smoothie', emoji: '🍌', desc: 'Omega-3s and sustained stamina release', veg: true },
    ],
    avoidFoods: ['High-sugar energy drinks (causes crash)', 'Processed pastry', 'Excessive caffeine'],
    tips: ['Ensure 7-8 hours of sleep tonight.', 'Check hydration levels.'],
  },
};

export function getHealthAdvice(condition: HealthCondition): HealthAdvice {
  return HEALTH_ADVICE_DATABASE[condition] || HEALTH_ADVICE_DATABASE.healthy;
}

export function parseCustomSymptoms(text: string): { condition: HealthCondition; detectedSymptoms: string[] } {
  if (!text || !text.trim()) return { condition: 'healthy', detectedSymptoms: [] };
  const lower = text.toLowerCase();
  const symptoms: string[] = [];
  let condition: HealthCondition = 'healthy';

  if (/fever|temp|temperature|chills|shivering|body pain|bodyache/.test(lower)) {
    condition = 'fever';
    symptoms.push('fever/temperature');
  } else if (/cough|cold|runny nose|phlegm|flu|congestion|sneez/.test(lower)) {
    condition = 'cough';
    symptoms.push('cough/cold');
  } else if (/stomach|acid|acidity|nausea|vomit|diarrhea|bloat|cramp|indigestion|gas|gut/.test(lower)) {
    condition = 'stomach_upset';
    symptoms.push('stomach upset/acidity');
  } else if (/throat|swallow|pharyngitis|hoarse/.test(lower)) {
    condition = 'sore_throat';
    symptoms.push('sore throat');
  } else if (/headache|tired|weakness|fatigue|exhaustion|low energy|dizzy/.test(lower)) {
    condition = 'fatigue';
    symptoms.push('fatigue/headache');
  }

  return { condition, detectedSymptoms: symptoms };
}

export interface HealthFoodValidation {
  isSuitable: boolean | 'caution';
  statusBadge: string;
  color: 'emerald' | 'amber' | 'rose';
  reason: string;
  suggestion: string;
}

export function validateFoodForDailyHealth(
  foodName: string,
  ingredients: string[] = [],
  condition: HealthCondition = 'healthy',
  customSymptoms?: string
): HealthFoodValidation {
  const combinedText = `${foodName} ${ingredients.join(' ')}`.toLowerCase();

  // If user has custom symptoms typed, derive active condition
  let activeCondition = condition;
  if (customSymptoms && customSymptoms.trim()) {
    const parsed = parseCustomSymptoms(customSymptoms);
    if (parsed.condition !== 'healthy') {
      activeCondition = parsed.condition;
    }
  }

  if (activeCondition === 'healthy') {
    return {
      isSuitable: true,
      statusBadge: 'Healthy Choice Today',
      color: 'emerald',
      reason: 'No active illness reported. Fits standard fitness goals.',
      suggestion: 'Maintain balanced hydration and macro targets.',
    };
  }

  const advice = getHealthAdvice(activeCondition);

  // Check for Cold / Frozen foods during Fever or Cough
  const isColdFood = /ice cream|iced|chilled|soda|cold drink|slush|popsicles|frozen/.test(combinedText);
  // Check for Deep Fried / High Oil
  const isFried = /fried|chip|crisps|pakora|samosa|deep fried|french fries|burger|greasy/.test(combinedText);
  // Check for Spicy
  const isSpicy = /spicy|chili|chilli|pepper|jalapeno|schezwan|hot sauce/.test(combinedText);
  // Check for Warm / Soothing foods
  const isWarmSoothing = /soup|khichdi|broth|dal|tea|warm|oats|porridge|curd rice|banana/.test(combinedText);

  if ((activeCondition === 'fever' || activeCondition === 'cough') && isColdFood) {
    return {
      isSuitable: false,
      statusBadge: `⚠️ Avoid Today for ${advice.title}`,
      color: 'rose',
      reason: `Chilled or frozen foods can worsen throat congestion and body chills during ${advice.title.toLowerCase()}.`,
      suggestion: `Swap for warm fluids, ginger turmeric tea, or clear vegetable soup.`,
    };
  }

  if ((activeCondition === 'fever' || activeCondition === 'cough' || activeCondition === 'stomach_upset') && isFried) {
    return {
      isSuitable: 'caution',
      statusBadge: `⚠️ Heavy Oily Food Alert`,
      color: 'amber',
      reason: `Deep fried & greasy foods place heavy stress on your digestive system while recovering from ${advice.title.toLowerCase()}.`,
      suggestion: `Opt for light, steamed, or boiled meals like moong dal khichdi.`,
    };
  }

  if (activeCondition === 'stomach_upset' && isSpicy) {
    return {
      isSuitable: false,
      statusBadge: `⚠️ Avoid for Stomach Upset`,
      color: 'rose',
      reason: `Spicy chilies and hot sauces irritate inflamed gastric mucosa and exacerbate acidity/nausea.`,
      suggestion: `Choose bland items like curd rice, banana, or warm chamomile tea.`,
    };
  }

  if (activeCondition === 'sore_throat' && /crispy|chips|nuts|lemon|citrus|raw tomato/.test(combinedText)) {
    return {
      isSuitable: 'caution',
      statusBadge: `⚠️ Throat Irritant Caution`,
      color: 'amber',
      reason: `Hard crunchy texture or high acidity can irritate an inflamed, painful throat.`,
      suggestion: `Select soft, smooth foods like mashed potatoes or warm oats porridge with honey.`,
    };
  }

  if (isWarmSoothing) {
    return {
      isSuitable: true,
      statusBadge: `✅ Excellent Recovery Choice`,
      color: 'emerald',
      reason: `This warm, soothing meal directly supports recovery for ${advice.title.toLowerCase()}.`,
      suggestion: `Stay hydrated and rest well today!`,
    };
  }

  return {
    isSuitable: true,
    statusBadge: `Suitable for ${advice.title}`,
    color: 'emerald',
    reason: `Acceptable to eat today in moderation.`,
    suggestion: `Drink warm water and listen to your body.`,
  };
}

const HEALTH_CHECKIN_STORAGE_KEY = 'healthify_daily_health';

export function getStoredHealthCheckin(dateStr?: string): DailyHealthCheckin {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  if (typeof window === 'undefined') {
    return { date: targetDate, condition: 'healthy' };
  }
  try {
    const raw = localStorage.getItem(HEALTH_CHECKIN_STORAGE_KEY);
    if (!raw) return { date: targetDate, condition: 'healthy' };
    const parsed: Record<string, DailyHealthCheckin> = JSON.parse(raw);
    return parsed[targetDate] || { date: targetDate, condition: 'healthy' };
  } catch {
    return { date: targetDate, condition: 'healthy' };
  }
}

export function saveHealthCheckin(checkin: DailyHealthCheckin) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(HEALTH_CHECKIN_STORAGE_KEY);
    const parsed: Record<string, DailyHealthCheckin> = raw ? JSON.parse(raw) : {};
    parsed[checkin.date] = checkin;
    localStorage.setItem(HEALTH_CHECKIN_STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
}
