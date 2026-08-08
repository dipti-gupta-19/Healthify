import { NextResponse } from 'next/server';
import { getDb, ObjectId } from '@/lib/mongodb';
import {
  analyzeFeedbackSymptoms,
  type FeedbackSymptom,
  type MealFeedback,
} from '@/lib/nutrition';

export async function POST(req: Request) {
  try {
    const userId = req.headers.get('x-user-id') || 'demo-user';
    const body = await req.json();
    const { mealId, symptoms, severity, notes, liked } = body as {
      mealId: string;
      symptoms: FeedbackSymptom[];
      severity: MealFeedback['severity'];
      notes?: string;
      liked?: boolean;
    };

    if (!mealId) {
      return NextResponse.json({ error: 'mealId required' }, { status: 400 });
    }

    const analysis = analyzeFeedbackSymptoms(symptoms || []);
    const feedback: MealFeedback = {
      symptoms: symptoms || [],
      severity: severity || 'none',
      notes,
      submittedAt: new Date().toISOString(),
      suspectedAllergy: analysis.suspectedAllergy,
      suspectedFoodPoisoning: analysis.suspectedFoodPoisoning,
      liked: liked ?? (symptoms?.length === 1 && symptoms[0] === 'none'),
    };

    const db = await getDb();

    const meal = await db.collection('meals').findOne({
      _id: new ObjectId(mealId),
      userId,
    });

    if (!meal) {
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    await db.collection('meals').updateOne(
      { _id: new ObjectId(mealId), userId },
      { $set: { feedback } },
    );

    if (analysis.suspectedAllergy && meal.ingredients) {
      const profile = await db.collection('profiles').findOne({ userId });
      if (profile) {
        const newAllergies = (meal.ingredients as string[])
          .filter((ing: string) => ing.length > 2)
          .slice(0, 3);
        const existing = profile.allergies || [];
        const merged = Array.from(new Set([...existing, ...newAllergies]));
        await db.collection('profiles').updateOne(
          { userId },
          { $set: { allergies: merged, updatedAt: new Date().toISOString() } },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      feedback,
      message: analysis.message,
      suspectedAllergy: analysis.suspectedAllergy,
      suspectedFoodPoisoning: analysis.suspectedFoodPoisoning,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Feedback failed: ${msg}` }, { status: 500 });
  }
}
