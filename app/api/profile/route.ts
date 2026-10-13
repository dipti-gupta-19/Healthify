import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import type { UserProfile } from '@/lib/nutrition';

export async function GET(req: Request) {
  try {
    const session = await getUserFromRequest(req);
    const userId = session?.userId || req.headers.get('x-user-id') || 'demo-user';
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ profile: null }, {
        headers: { 'Cache-Control': 'private, max-age=10' },
      });
    }
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
    const cleanData = {
      ...body,
      userId,
      updatedAt: new Date().toISOString(),
    };

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ ok: true, profile: cleanData });
    }

    const db = await getDb();

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
