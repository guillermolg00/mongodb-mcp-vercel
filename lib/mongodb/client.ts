import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

/**
 * Get or create a MongoDB client singleton.
 * Reuses the same client across serverless function invocations.
 */
async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  if (client) {
    return client;
  }

  if (!clientPromise) {
    clientPromise = MongoClient.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 10000,
    }).then((connectedClient) => {
      client = connectedClient;
      return connectedClient;
    });
  }

  return clientPromise;
}

/**
 * Get the configured database.
 * Database name is fixed via MONGODB_DB env to prevent unauthorized access.
 */
export async function getDatabase(): Promise<Db> {
  const dbName = process.env.MONGODB_DB;

  if (!dbName) {
    throw new Error("MONGODB_DB environment variable is not set");
  }

  const mongoClient = await getMongoClient();
  return mongoClient.db(dbName);
}

/**
 * Get the database name from environment.
 */
export function getDatabaseName(): string {
  const dbName = process.env.MONGODB_DB;

  if (!dbName) {
    throw new Error("MONGODB_DB environment variable is not set");
  }

  return dbName;
}
