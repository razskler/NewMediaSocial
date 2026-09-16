import { ObjectId, type Db, type Filter, type WithId } from "mongodb";
import { getDb } from "./mongo";
import { followedUserIds } from "./follows";
import { authorInfoFor } from "./profiles";
import { RANKING_CONFIG, rankScore } from "./ranking";

export type FeedMode = "suggested" | "following" | "topic" | "user" | "likes";

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarMediaId: string | null;
  text: string;
  mediaIds: string[];
  hashtags: string[];
  createdAt: string;
  likesCount: number;
  likedByMe: boolean;
  commentsCount: number;
};

type PostDoc = {
  authorId: string;
  authorName: string;
  text: string;
  createdAt: Date;
  likesCount: number;
  commentsCount?: number;
  mediaIds?: ObjectId[];
  hashtags?: string[];
};

type LikeDoc = {
  postId: ObjectId;
  userId: string;
  createdAt: Date;
};

export type TrendingTag = { tag: string; count: number };

export const PAGE_SIZE = 20;
export const MAX_MEDIA_PER_POST = 5;

let indexesReady: Promise<void> | null = null;

async function readyDb(): Promise<Db> {
  const db = await getDb();
  if (!indexesReady) {
    indexesReady = Promise.all([
      // Unique index guarantees one like per user per post at the DB level.
      db
        .collection<LikeDoc>("likes")
        .createIndex({ postId: 1, userId: 1 }, { unique: true }),
      db.collection<PostDoc>("posts").createIndex({ authorId: 1, _id: -1 }),
      db.collection<PostDoc>("posts").createIndex({ hashtags: 1, _id: -1 }),
    ])
      .then(() => undefined)
      .catch((err) => {
        indexesReady = null;
        throw err;
      });
  }
  await indexesReady;
  return db;
}

/** Extracts #hashtags from text: lowercase, deduped, capped at 8 tags. */
export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  for (const match of text.toLowerCase().matchAll(/(?:^|\s)#([a-z0-9_]{1,30})/g)) {
    tags.add(match[1]);
    if (tags.size >= 8) {
      break;
    }
  }
  return [...tags];
}

async function toPosts(
  db: Db,
  docs: WithId<PostDoc>[],
  viewerId: string | null,
): Promise<Post[]> {
  const authorMap = await authorInfoFor([...new Set(docs.map((d) => d.authorId))]);

  let likedIds = new Set<string>();
  if (viewerId && docs.length > 0) {
    const likes = await db
      .collection<LikeDoc>("likes")
      .find({ userId: viewerId, postId: { $in: docs.map((d) => d._id) } })
      .project<{ postId: ObjectId }>({ postId: 1 })
      .toArray();
    likedIds = new Set(likes.map((l) => l.postId.toHexString()));
  }

  return docs.map((d) => ({
    id: d._id.toHexString(),
    authorId: d.authorId,
    authorName: d.authorName,
    authorUsername: authorMap.get(d.authorId)?.username ?? null,
    authorAvatarMediaId: authorMap.get(d.authorId)?.avatarMediaId ?? null,
    text: d.text,
    mediaIds: (d.mediaIds ?? []).map((m) => m.toHexString()),
    hashtags: d.hashtags ?? [],
    createdAt: d.createdAt.toISOString(),
    likesCount: d.likesCount,
    likedByMe: likedIds.has(d._id.toHexString()),
    commentsCount: d.commentsCount ?? 0,
  }));
}

async function chronologicalFeed(
  db: Db,
  baseFilter: Filter<PostDoc>,
  viewerId: string | null,
  cursor: string | null,
) {
  const query: Filter<PostDoc> = {
    ...baseFilter,
    ...(cursor && ObjectId.isValid(cursor)
      ? { _id: { $lt: new ObjectId(cursor) } }
      : {}),
  };

  const docs = await db
    .collection<PostDoc>("posts")
    .find(query)
    .sort({ _id: -1 })
    .limit(PAGE_SIZE + 1)
    .toArray();

  const hasMore = docs.length > PAGE_SIZE;
  const page = hasMore ? docs.slice(0, PAGE_SIZE) : docs;

  return {
    posts: await toPosts(db, page, viewerId),
    nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null,
  };
}

/**
 * Suggested feed: rank a candidate window of recent posts with the
 * tunable score from ranking.ts. The cursor is a rank offset within
 * the current snapshot (scores shift as posts age, so pure key
 * pagination doesn't apply).
 */
async function suggestedFeed(db: Db, viewerId: string | null, cursor: string | null) {
  const windowDocs = await db
    .collection<PostDoc>("posts")
    .find({})
    .sort({ _id: -1 })
    .limit(RANKING_CONFIG.candidateWindow)
    .toArray();

  let followedSet = new Set<string>();
  if (viewerId) {
    followedSet = new Set(await followedUserIds(viewerId));
  }

  const offset = cursor && /^\d+$/.test(cursor) ? parseInt(cursor, 10) : 0;
  const ranked = windowDocs
    .map((doc) => ({
      doc,
      score: rankScore(
        {
          createdAt: doc.createdAt,
          likesCount: doc.likesCount,
          commentsCount: doc.commentsCount ?? 0,
        },
        followedSet.has(doc.authorId),
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.doc._id.toHexString() < b.doc._id.toHexString() ? 1 : -1),
    );

  const pagePairs = ranked.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < ranked.length;

  return {
    posts: await toPosts(db, pagePairs.map((p) => p.doc), viewerId),
    nextCursor: hasMore ? String(offset + PAGE_SIZE) : null,
  };
}

/** Posts a user has liked, paginated by the like rows themselves. */
async function likedFeed(
  db: Db,
  authorId: string,
  viewerId: string | null,
  cursor: string | null,
) {
  const likes = await db
    .collection<LikeDoc>("likes")
    .find({
      userId: authorId,
      ...(cursor && ObjectId.isValid(cursor)
        ? { _id: { $lt: new ObjectId(cursor) } }
        : {}),
    })
    .sort({ _id: -1 })
    .limit(PAGE_SIZE + 1)
    .toArray();

  const hasMore = likes.length > PAGE_SIZE;
  const pageLikes = hasMore ? likes.slice(0, PAGE_SIZE) : likes;

  const docsById = new Map<string, WithId<PostDoc>>();
  if (pageLikes.length > 0) {
    const docs = await db
      .collection<PostDoc>("posts")
      .find({ _id: { $in: pageLikes.map((l) => l.postId) } })
      .toArray();
    for (const doc of docs) {
      docsById.set(doc._id.toHexString(), doc);
    }
  }

  // Preserve like order; drop posts deleted since they were liked.
  const page = pageLikes
    .map((l) => docsById.get(l.postId.toHexString()))
    .filter((d): d is WithId<PostDoc> => d !== undefined);

  return {
    posts: await toPosts(db, page, viewerId),
    nextCursor: hasMore ? pageLikes[pageLikes.length - 1]._id.toHexString() : null,
  };
}

export async function getFeed(options: {
  viewerId?: string | null;
  cursor?: string | null;
  mode?: FeedMode;
  tag?: string | null;
  authorId?: string | null;
}): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const db = await readyDb();
  const {
    viewerId = null,
    cursor = null,
    mode = "suggested",
    tag = null,
    authorId = null,
  } = options;

  switch (mode) {
    case "following": {
      if (!viewerId) {
        return { posts: [], nextCursor: null };
      }
      const ids = [...(await followedUserIds(viewerId)), viewerId];
      return chronologicalFeed(db, { authorId: { $in: ids } }, viewerId, cursor);
    }
    case "topic": {
      const normalized = tag?.toLowerCase().replace(/^#/, "") ?? null;
      if (!normalized || !/^[a-z0-9_]{1,30}$/.test(normalized)) {
        return { posts: [], nextCursor: null };
      }
      return chronologicalFeed(db, { hashtags: normalized }, viewerId, cursor);
    }
    case "user": {
      if (!authorId) {
        return { posts: [], nextCursor: null };
      }
      return chronologicalFeed(db, { authorId }, viewerId, cursor);
    }
    case "likes": {
      if (!authorId) {
        return { posts: [], nextCursor: null };
      }
      return likedFeed(db, authorId, viewerId, cursor);
    }
    default: {
      return suggestedFeed(db, viewerId, cursor);
    }
  }
}

/** Hashtag usage counts over the last 7 days, most used first. */
export async function getTrendingHashtags(
  limit = 12,
): Promise<TrendingTag[]> {
  const db = await readyDb();
  const since = new Date(Date.now() - 7 * 24 * 3_600_000);
  const rows = await db
    .collection<PostDoc>("posts")
    .aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since }, hashtags: { $ne: [] } } },
      { $unwind: "$hashtags" },
      { $group: { _id: "$hashtags", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit },
    ])
    .toArray();
  return rows.map((r) => ({ tag: r._id, count: r.count }));
}

export async function createPost(input: {
  authorId: string;
  authorName: string;
  text: string;
  mediaIds?: ObjectId[];
  hashtags?: string[];
  /**
   * Backdated creation (used by the bot seeder). Chronological feeds
   * sort by _id, so the _id is derived from this timestamp — callers
   * must not pass the same second twice within the collection.
   */
  createdAt?: Date;
}): Promise<Post> {
  const db = await readyDb();
  const now = input.createdAt ?? new Date();
  const mediaIds = input.mediaIds ?? [];
  const hashtags = input.hashtags ?? extractHashtags(input.text);

  const doc: PostDoc & { _id?: ObjectId } = {
    authorId: input.authorId,
    authorName: input.authorName,
    text: input.text,
    createdAt: now,
    likesCount: 0,
    commentsCount: 0,
    mediaIds,
    hashtags,
  };
  if (input.createdAt) {
    doc._id = ObjectId.createFromTime(Math.floor(now.getTime() / 1000));
  }

  const result = await db.collection<PostDoc>("posts").insertOne(doc);

  const authorMap = await authorInfoFor([input.authorId]);
  const author = authorMap.get(input.authorId);

  return {
    id: result.insertedId.toHexString(),
    authorId: input.authorId,
    authorName: input.authorName,
    authorUsername: author?.username ?? null,
    authorAvatarMediaId: author?.avatarMediaId ?? null,
    text: input.text,
    mediaIds: mediaIds.map((m) => m.toHexString()),
    hashtags,
    createdAt: now.toISOString(),
    likesCount: 0,
    likedByMe: false,
    commentsCount: 0,
  };
}

export async function toggleLike(
  postId: string,
  userId: string,
  /** Backdated like timestamp (bot seeder); _id is derived from it. */
  createdAt?: Date,
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
    const likeDoc: LikeDoc & { _id?: ObjectId } = {
      postId: pid,
      userId,
      createdAt: createdAt ?? new Date(),
    };
    if (createdAt) {
      likeDoc._id = ObjectId.createFromTime(
        Math.floor(createdAt.getTime() / 1000),
      );
    }
    await db.collection<LikeDoc>("likes").insertOne(likeDoc);
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
