import type { Db } from "mongodb";
import { getDb } from "./mongo";

type FollowDoc = {
  followerId: string;
  followeeId: string;
  createdAt: Date;
};

let indexesReady: Promise<void> | null = null;

async function readyDb(): Promise<Db> {
  const db = await getDb();
  if (!indexesReady) {
    // Unique index guarantees one follow edge per user pair at the DB level.
    indexesReady = db
      .collection<FollowDoc>("follows")
      .createIndex({ followerId: 1, followeeId: 1 }, { unique: true })
      .then(() => undefined)
      .catch((err) => {
        indexesReady = null;
        throw err;
      });
  }
  await indexesReady;
  return db;
}

export async function toggleFollow(
  followerId: string,
  followeeId: string,
): Promise<{ following: boolean; followersCount: number }> {
  const db = await readyDb();

  // Unfollow: removing an existing edge.
  const removed = await db
    .collection<FollowDoc>("follows")
    .deleteOne({ followerId, followeeId });
  if (removed.deletedCount === 1) {
    const followersCount = await db
      .collection<FollowDoc>("follows")
      .countDocuments({ followeeId });
    return { following: false, followersCount };
  }

  // Follow: insert; a duplicate-key error means another request already
  // followed, which is fine.
  try {
    await db
      .collection<FollowDoc>("follows")
      .insertOne({ followerId, followeeId, createdAt: new Date() });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const followersCount = await db
        .collection<FollowDoc>("follows")
        .countDocuments({ followeeId });
      return { following: true, followersCount };
    }
    throw err;
  }

  const followersCount = await db
    .collection<FollowDoc>("follows")
    .countDocuments({ followeeId });
  return { following: true, followersCount };
}

export async function isFollowing(
  followerId: string,
  followeeId: string,
): Promise<boolean> {
  const db = await readyDb();
  const doc = await db
    .collection<FollowDoc>("follows")
    .findOne({ followerId, followeeId }, { projection: { _id: 1 } });
  return doc !== null;
}

export async function followedUserIds(
  followerId: string,
): Promise<string[]> {
  const db = await readyDb();
  const docs = await db
    .collection<FollowDoc>("follows")
    .find({ followerId })
    .project<{ followeeId: string }>({ followeeId: 1 })
    .limit(1000)
    .toArray();
  return docs.map((d) => d.followeeId);
}

export async function followCounts(
  userId: string,
): Promise<{ followers: number; following: number }> {
  const db = await readyDb();
  const [followers, following] = await Promise.all([
    db.collection<FollowDoc>("follows").countDocuments({ followeeId: userId }),
    db.collection<FollowDoc>("follows").countDocuments({ followerId: userId }),
  ]);
  return { followers, following };
}
