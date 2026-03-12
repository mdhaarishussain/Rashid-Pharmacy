import { MongoClient, Db, ObjectId } from 'mongodb';

let db: Db | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export const connectMongoDB = async (): Promise<void> => {
  if (db) {
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not set in environment variables');
  }

  try {
    if (!clientPromise) {
      const client = new MongoClient(uri);
      clientPromise = client.connect();
    }

    const client = await clientPromise;
    db = client.db('clinic_memory_os');

    // Create collections if they don't exist
    await ensureCollections();
    console.log('📦 Collections initialized');
  } catch (error) {
    clientPromise = null;
    console.error('MongoDB connection failed:', error);
    throw error;
  }
};

export const getDB = (): Db => {
  if (!db) {
    throw new Error('Database not connected. Call connectMongoDB first.');
  }
  return db;
};

const ensureCollections = async () => {
  const database = getDB();
  const collections = await database.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  // Create patients collection
  if (!collectionNames.includes('patients')) {
    await database.createCollection('patients');
    await database.collection('patients').createIndex({ name: 1 });
    await database.collection('patients').createIndex({ created_at: 1 });
    console.log('  ✓ patients collection created');
  }

  // Create visits collection
  if (!collectionNames.includes('visits')) {
    await database.createCollection('visits');
    await database.collection('visits').createIndex({ patient_id: 1 });
    await database.collection('visits').createIndex({ date: -1 });
    await database.collection('visits').createIndex({ updated_at: 1 });
    console.log('  ✓ visits collection created');
  }

  // Create sync_log collection (tracks last sync times)
  if (!collectionNames.includes('sync_log')) {
    await database.createCollection('sync_log');
    await database.collection('sync_log').createIndex({ device_id: 1, timestamp: -1 });
    console.log('  ✓ sync_log collection created');
  }
};

// Collections interface
export interface Patient {
  _id?: ObjectId;
  name: string;
  quick_note?: string;
  created_at: number;
  updated_at: number;
}

export interface Visit {
  _id?: ObjectId;
  patient_id: string;
  date: number;
  symptoms_text: string;
  medicines_json: any[];
  fee_total: number;
  amount_paid: number;
  amount_due: number;
  visit_number: number;
  created_at: number;
  updated_at: number;
}

export interface SyncLog {
  _id?: ObjectId;
  device_id: string;
  last_sync: number;
  timestamp: number;
}
