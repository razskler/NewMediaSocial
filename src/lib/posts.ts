import { ObjectId, type Db, type Filter } from "mongodb";
import { getDb } from "./mongo";

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  likesCount: number;
  likedByMe: boolean;
};

type PostDoc = {
  authorId: string;
  authorName: string;
  text: string;
  createdAt: Date;
  likesCount: number;
};

type LikeDoc = {
  postId: ObjectId;
  userId: string;
  createdAt: Date;
};

export const PAGE_SIZE = 20;

let indexesReady: Promise<void> | null = null;

async function readyDb(): Promise<Db> {
  const db = await getDb();
  if (!indexesReady) {
    // Unique index guarantees one like per user per post at the DB level.
    indexesReady = db
      .collection<LikeDoc>("likes")
      .createIndex({ postId: 1, userId: 1 }, { unique: true })
      .then(() => undefined)
      .catch((err) => {
        indexesReady = null;
        throw err;
      });
  }
  await indexesReady;
  return db;
}

export async function getFeed(options: {
  viewerId?: string | null;
  cursor?: string | null;
}): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const db = await readyDb();
  const { viewerId = null, cursor = null } = options;

  const query: Filter<PostDoc> =
    cursor && ObjectId.isValid(cursor)
      ? { _id: { $lt: new ObjectId(cursor) } }
      : {};

  // One extra document tells us whether another page exists.
  const docs = await db
    .collection<PostDoc>("posts")
    .find(query)
    .sort({ _id: -1 })
    .limit(PAGE_SIZE + 1)
    .toArray();

  const hasMore = docs.length > PAGE_SIZE;
  const page = hasMore ? docs.slice(0, PAGE_SIZE) : docs;

  let likedIds = new Set<string>();
  if (viewerId && page.length > 0) {
    const likes = await db
      .collection<LikeDoc>("likes")
      .find({ userId: viewerId, postId: { $in: page.map((d) => d._id) } })
      .project<{ postId: ObjectId }>({ postId: 1 })
      .toArray();
    likedIds = new Set(likes.map((l) => l.postId.toHexString()));
  }

  return {
    posts: page.map((d) => ({
      id: d._id.toHexString(),
      authorId: d.authorId,
      authorName: d.authorName,
      text: d.text,
      createdAt: d.createdAt.toISOString(),
      likesCount: d.likesCount,
      likedByMe: likedIds.has(d._id.toHexString()),
    })),
    nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null,
  };
}

export async function createPost(input: {
  authorId: string;
  authorName: string;
  text: string;
}): Promise<Post> {
  const db = await readyDb();
  const now = new Date();
  const result = await db.collection<PostDoc>("posts").insertOne({
    authorId: input.authorId,
    authorName: input.authorName,
    text: input.text,
    createdAt: now,
    likesCount: 0,
  });

  return {
    id: result.insertedId.toHexString(),
    authorId: input.authorId,
    authorName: input.authorName,
    text: input.text,
    createdAt: now.toISOString(),
    likesCount: 0,
    likedByMe: false,
  };
}

export async function toggleLike(
  postId: string,
  userId: string,
): Promise<{ liked: boolean; likesCount: number }> {
  const db = await readyDb();
  if (!ObjectId.isValid(postId)) {
    throw new Error("Invalid post id");
  }
  const pid = new ObjectId(postId);

  // Unlike: removing an existing (postId, userId) row.
  const removed = await db
    .collection<LikeDoc>("likes")
    .deleteOne({ postId: pid, userId });
  if (removed.deletedCount === 1) {
    const post = await db.collection<PostDoc>("posts").findOneAndUpdate(
      { _id: pid },
      { $inc: { likesCount: -1 } },
      { projection: { likesCount: 1 } },
    );
    return {
      liked: false,
      likesCount: post ? Math.max(0, post.likesCount) : 0,
    };
  }

  // Like: insert; a duplicate-key error means another request already
  // liked it, which is fine.
  try {
    await db
      .collection<LikeDoc>("likes")
      .insertOne({ postId: pid, userId, createdAt: new Date() });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const post = await db
        .collection<PostDoc>("posts")
        .findOne({ _id: pid }, { projection: { likesCount: 1 } });
      return { liked: true, likesCount: post?.likesCount ?? 0 };
    }
    throw err;
  }

  const post = await db.collection<PostDoc>("posts").findOneAndUpdate(
    { _id: pid },
    { $inc: { likesCount: 1 } },
    { projection: { likesCount: 1 } },
  );

  if (!post) {
    // The post vanished between the two writes: undo the like row.
    await db.collection<LikeDoc>("likes").deleteOne({ postId: pid, userId });
    throw new Error("Post not found");
  }

  return { liked: true, likesCount: post.likesCount };
}
