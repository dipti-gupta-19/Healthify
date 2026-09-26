import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import type { UserProfile } from '@/lib/nutrition';

export async function GET(req: Request) {
  try {
    const session = await getUserFromRequest(req);
    const userId = session?.userId || req.headers.get('x-user-id') || 'demo-user';
    const db = await getDb();
    const profile = await db.collection('profiles').findOne({ userId });
    return NextResponse.json({ profile }, {
      headers: { 'Cache-Control': 'private, max-age=10' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to load profile: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getUserFromRequest(req);
    const userId = session?.userId || req.headers.get('x-user-id') || 'demo-user';
    const body = (await req.json()) as UserProfile;
    const db = await getDb();

    const cleanData = {
      ...body,
      userId,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('profiles').updateOne(
      { userId },
      { $set: cleanData },
      { upsert: true },
    );
    return NextResponse.json({ ok: true, profile: cleanData });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to save profile: ${msg}` }, { status: 500 });
  }
}
