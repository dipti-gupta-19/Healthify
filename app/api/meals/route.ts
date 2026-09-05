import { NextResponse } from 'next/server';
import { getDb, ObjectId } from '@/lib/mongodb';
import { getMealType, type LoggedMeal } from '@/lib/nutrition';

function serializeMeal(doc: Record<string, unknown>) {
  const id = doc._id;
  const _id = typeof id === 'object' && id !== null && 'toString' in id
    ? String((id as { toString: () => string }).toString())
    : String(id ?? '');
  return { ...doc, _id };
}

export async function GET(req: Request) {
  try {
    const userId = req.headers.get('x-user-id') || 'demo-user';
    const db = await getDb();
    const meals = await db
      .collection('meals')
      .find({ userId })
      .sort({ loggedAt: -1 })
      .toArray();
    return NextResponse.json({ meals: meals.map((m) => serializeMeal(m as Record<string, unknown>)) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to load meals: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = req.headers.get('x-user-id') || 'demo-user';
    const body = await req.json();
    const db = await getDb();
    const mealType = body.mealType || getMealType(new Date().getHours());
    const meal: LoggedMeal = {
      userId,
      foodName: body.foodName,
      emoji: body.emoji || '🍽️',
      facts: body.facts,
      verdict: body.verdict || 'good',
      loggedAt: body.loggedAt || new Date().toISOString(),
      mealType,
      warnings: body.warnings || [],
      ingredients: body.ingredients || [],
      beneficialAspects: body.beneficialAspects || [],
      harmfulAdditives: body.harmfulAdditives || [],
      healthConcerns: body.healthConcerns || [],
      isJunkFood: body.isJunkFood || false,
      portionAdvice: body.portionAdvice || undefined,
    };
    const result = await db.collection('meals').insertOne(meal as any);
    return NextResponse.json({ ok: true, _id: result.insertedId.toString(), meal: serializeMeal({ ...meal, _id: result.insertedId } as Record<string, unknown>) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to log meal: ${msg}` }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = req.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(req.url);
    const mealId = searchParams.get('id');
    if (!mealId) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (!ObjectId.isValid(mealId)) return NextResponse.json({ ok: true });
    const db = await getDb();
    await db.collection('meals').deleteOne({ _id: new ObjectId(mealId), userId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to delete meal: ${msg}` }, { status: 500 });
  }
}
