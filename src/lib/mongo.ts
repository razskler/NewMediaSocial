import { MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10_000,
    });
    globalThis._mongoClientPromise = client.connect();
  }
  return globalThis._mongoClientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB ?? "newmediasocial");
}
