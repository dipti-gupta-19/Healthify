import crypto from 'crypto';
import { getDb } from './mongodb';

export interface UserDoc {
  _id?: string;
  userId: string;
  email: string;
  name: string;
  passwordHash: string;
  plainPassword?: string;
  createdAt: string;
}

export const DEMO_USER_EMAIL = 'demo@healthify.com';
export const DEMO_USER_PASSWORD = 'password123';
export const DEMO_USER_ID = 'demo_user_id';

export function hashPassword(password: string): string {
  const salt = process.env.AUTH_SECRET || 'healthify-secret-salt-key-2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function createToken(userId: string, email: string): string {
  const payload = { userId, email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const jsonStr = Buffer.from(token, 'base64url').toString('utf8');
    const data = JSON.parse(jsonStr);
    if (!data.userId || data.exp < Date.now()) return null;
    return { userId: data.userId, email: data.email };
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: Request): Promise<{ userId: string; email?: string } | null> {
  const authHeader = req.headers.get('authorization');
  const userIdHeader = req.headers.get('x-user-id');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded) return decoded;
  }

  // Check cookies if present
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/healthify_token=([^;]+)/);
  if (match) {
    const decoded = verifyToken(match[1]);
    if (decoded) return decoded;
  }

  if (userIdHeader && userIdHeader !== 'demo-user') {
    return { userId: userIdHeader };
  }

  return null;
}

/**
 * Ensures the default demo user exists in MongoDB and migrates any old 'demo-user' data to it.
 */
export async function ensureDemoUserAndMigrate() {
  try {
    const db = await getDb();
    
    // Check if demo user exists
    let demoUser = await db.collection('users').findOne({ email: DEMO_USER_EMAIL });
    
    if (!demoUser) {
      const passwordHash = hashPassword(DEMO_USER_PASSWORD);
      const newDemoUser = {
        userId: DEMO_USER_ID,
        email: DEMO_USER_EMAIL,
        name: 'Demo User',
        passwordHash,
        plainPassword: DEMO_USER_PASSWORD,
        createdAt: new Date().toISOString(),
      };
      await db.collection('users').insertOne(newDemoUser as any);
      demoUser = newDemoUser as any;
    } else if (!demoUser.plainPassword) {
      await db.collection('users').updateOne(
        { email: DEMO_USER_EMAIL },
        { $set: { plainPassword: DEMO_USER_PASSWORD } }
      );
    }

    // Migrate any legacy 'demo-user' profiles to DEMO_USER_ID
    await db.collection('profiles').updateMany(
      { userId: 'demo-user' },
      { $set: { userId: DEMO_USER_ID } }
    );

    // Migrate any legacy 'demo-user' meals to DEMO_USER_ID
    await db.collection('meals').updateMany(
      { userId: 'demo-user' },
      { $set: { userId: DEMO_USER_ID } }
    );
  } catch (err) {
    console.error('Failed to migrate demo user:', err);
  }
}
