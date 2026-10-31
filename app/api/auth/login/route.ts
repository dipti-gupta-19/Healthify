import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { hashPassword, createToken, ensureDemoUserAndMigrate } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    await ensureDemoUserAndMigrate();

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (!process.env.MONGODB_URI) {
      if (cleanEmail === 'demo@healthify.com' && password === 'password123') {
        const token = createToken('demo-user', cleanEmail);
        const res = NextResponse.json({
          ok: true,
          user: { userId: 'demo-user', email: 'demo@healthify.com', name: 'Demo User' },
          profile: null,
          token,
        });
        res.cookies.set('healthify_token', token, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });
        return res;
      }
      return NextResponse.json({
        error: 'MongoDB is not configured. Add MONGODB_URI to your .env.local file, or use the Demo Account to sign in.',
      }, { status: 400 });
    }

    const db = await getDb();

    const user = await db.collection('users').findOne({ email: cleanEmail });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const passwordHash = hashPassword(password);
    if (user.passwordHash !== passwordHash && user.plainPassword !== password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Ensure plainPassword is updated if missing
    if (!user.plainPassword) {
      await db.collection('users').updateOne(
        { userId: user.userId },
        { $set: { plainPassword: password } }
      );
    }

    const profile = await db.collection('profiles').findOne({ userId: user.userId });

    const token = createToken(user.userId, cleanEmail);

    const res = NextResponse.json({
      ok: true,
      user: { userId: user.userId, email: user.email, name: user.name },
      profile: profile || null,
      token,
    });

    res.cookies.set('healthify_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
