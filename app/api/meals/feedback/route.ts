import { NextResponse } from 'next/server';
import { getDb, ObjectId } from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import {
  analyzeFeedbackSymptoms,
  type FeedbackSymptom,
  type MealFeedback,
} from '@/lib/nutrition';

export async function POST(req: Request) {
  try {
    const session = await getUserFromRequest(req);
    const userId = session?.userId || req.headers.get('x-user-id') || 'demo-user';
    const body = await req.json();

    const db = await getDb();

    // Handle AI Scan Autocorrect feedback logging
    if (body.scanCorrection) {
      await db.collection('corrections').insertOne({
        ...body.scanCorrection,
        userId,
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

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

    // Try finding by ObjectId or by string id
    let queryFilter: any = { userId };
    if (ObjectId.isValid(mealId)) {
      queryFilter._id = new ObjectId(mealId);
    } else {
      queryFilter._id = mealId;
    }

    let meal = await db.collection('meals').findOne(queryFilter);

    // Fallback: search by _id alone if user ID migrated
    if (!meal && ObjectId.isValid(mealId)) {
      meal = await db.collection('meals').findOne({ _id: new ObjectId(mealId) });
    }

    if (!meal) {
      // Create a fallback feedback log so the user's feedback is never lost
      await db.collection('feedbacks').insertOne({
        mealId,
        userId,
        feedback,
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json({
        ok: true,
        feedback,
        message: analysis.message || 'Feedback recorded successfully!',
        suspectedAllergy: analysis.suspectedAllergy,
        suspectedFoodPoisoning: analysis.suspectedFoodPoisoning,
      });
    }

    await db.collection('meals').updateOne(
      { _id: meal._id },
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
      message: analysis.message || 'Feedback recorded successfully!',
      suspectedAllergy: analysis.suspectedAllergy,
      suspectedFoodPoisoning: analysis.suspectedFoodPoisoning,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Feedback failed: ${msg}` }, { status: 500 });
  }
}
