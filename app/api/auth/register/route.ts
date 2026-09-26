import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { hashPassword, createToken, ensureDemoUserAndMigrate } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    await ensureDemoUserAndMigrate();

    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDb();

    const existing = await db.collection('users').findOne({ email: cleanEmail });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();

    const userDoc = {
      userId,
      email: cleanEmail,
      name: name.trim(),
      passwordHash,
      plainPassword: password, // Stored in MongoDB so admin can view user passwords in DB
      createdAt,
    };

    await db.collection('users').insertOne(userDoc);

    // Initialize individual profile for this new user
    const initialProfile = {
      userId,
      name: name.trim(),
      age: 25,
      sex: 'male',
      weightKg: 70,
      heightCm: 170,
      activityLevel: 'moderate',
      goal: 'maintain',
      dietType: 'vegetarian',
      medicalConditions: [],
      allergies: [],
      updatedAt: createdAt,
    };

    await db.collection('profiles').updateOne(
      { userId },
      { $set: initialProfile },
      { upsert: true }
    );

    const token = createToken(userId, cleanEmail);

    const res = NextResponse.json({
      ok: true,
      user: { userId, email: cleanEmail, name: name.trim() },
      profile: initialProfile,
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
    const msg = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
