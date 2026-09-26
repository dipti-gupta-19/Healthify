import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getUserFromRequest, ensureDemoUserAndMigrate } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await ensureDemoUserAndMigrate();

    const session = await getUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ user: null, profile: null });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne({ userId: session.userId });
    if (!user) {
      return NextResponse.json({ user: null, profile: null });
    }

    const profile = await db.collection('profiles').findOne({ userId: session.userId });

    return NextResponse.json({
      user: { userId: user.userId, email: user.email, name: user.name },
      profile: profile || null,
    });
  } catch (err) {
    return NextResponse.json({ user: null, profile: null });
  }
}
