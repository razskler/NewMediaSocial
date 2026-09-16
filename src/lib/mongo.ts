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

/**
 * Closes the cached client. Long-running processes never need this; the
 * bot one-shot commands (seed/purge) call it so node can exit instead of
 * waiting on the open connection pool forever.
 */
export async function closeDb(): Promise<void> {
  if (globalThis._mongoClientPromise) {
    const closing = globalThis._mongoClientPromise;
    globalThis._mongoClientPromise = undefined;
    await closing.then((client) => client.close());
  }
}
