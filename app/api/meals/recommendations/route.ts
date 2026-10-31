import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import { calculateTargets, type UserProfile } from '@/lib/nutrition';
import {
  generateFeedbackRecommendationsFromRaw,
  buildFeedbackInsights,
} from '@/lib/feedback-recommendations';

export async function GET(req: Request) {
  try {
    const session = await getUserFromRequest(req);
    const userId = session?.userId || req.headers.get('x-user-id') || 'demo-user';

    // Without DB we can't compute server-side recs — client will use local meals
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ recommendations: [], insights: null });
    }

    const db = await getDb();

    // Load meals WITH feedback
    const meals = await db
      .collection('meals')
      .find({ userId, feedback: { $exists: true } })
      .sort({ loggedAt: -1 })
      .limit(200)
      .toArray();

    if (meals.length === 0) {
      return NextResponse.json({ recommendations: [], insights: null });
    }

    // Load user profile for context
    const profile = await db.collection('profiles').findOne({ userId });
    if (!profile) {
      return NextResponse.json({ recommendations: [], insights: null });
    }

    const userProfile = profile as unknown as UserProfile;
    const targets = calculateTargets(userProfile);

    const recommendations = generateFeedbackRecommendationsFromRaw(meals, userProfile, targets);
    const insights = buildFeedbackInsights(meals as any);

    return NextResponse.json({ recommendations, insights });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate recommendations: ${msg}` },
      { status: 500 },
    );
  }
}
