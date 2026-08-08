import { MongoClient, Db, ObjectId } from 'mongodb';

export { ObjectId };

const uri = process.env.MONGODB_URI as string;
const dbName = process.env.MONGODB_DB || 'healthify';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let connecting = false;

export async function getDb(): Promise<Db> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  if (cachedClient && cachedDb) {
    return cachedDb;
  }
  if (connecting) {
    while (connecting) {
      await new Promise((r) => setTimeout(r, 100));
      if (cachedDb) return cachedDb;
    }
  }
  connecting = true;
  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    await client.connect();
    cachedClient = client;
    cachedDb = client.db(dbName);
    return cachedDb;
  } finally {
    connecting = false;
  }
}
