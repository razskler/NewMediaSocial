import { ObjectId, type Db, type WithId } from "mongodb";
import { getDb } from "./mongo";
import { authorInfoFor } from "./profiles";

export type Comment = {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarMediaId: string | null;
  text: string;
  createdAt: string;
};

export type CommentThread = Comment & { replies: Comment[] };

// A user's comment joined with the parent post it was made on.
export type UserComment = Comment & {
  post: { id: string; authorName: string; snippet: string } | null;
};

type CommentDoc = {
  postId: ObjectId;
  parentId: ObjectId | null;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: Date;
};

export const COMMENTS_PAGE_SIZE = 20;

let indexesReady: Promise<void> | null = null;

async function readyDb(): Promise<Db> {
  const db = await getDb();
  if (!indexesReady) {
    indexesReady = Promise.all([
      db.collection<CommentDoc>("comments").createIndex({
        postId: 1,
        createdAt: 1,
      }),
      db.collection<CommentDoc>("comments").createIndex({
        authorId: 1,
        _id: -1,
      }),
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

type AuthorInfo = { username: string; avatarMediaId: string | null };

function toComment(
  d: WithId<CommentDoc>,
  author: AuthorInfo | undefined,
): Comment {
  return {
    id: d._id.toHexString(),
    postId: d.postId.toHexString(),
    parentId: d.parentId ? d.parentId.toHexString() : null,
    authorId: d.authorId,
    authorName: d.authorName,
    authorUsername: author?.username ?? null,
    authorAvatarMediaId: author?.avatarMediaId ?? null,
    text: d.text,
    createdAt: d.createdAt.toISOString(),
  };
}

/** All comments for a post, grouped into top-level threads with replies. */
export async function listComments(postId: string): Promise<CommentThread[]> {
  if (!ObjectId.isValid(postId)) {
    return [];
  }
  const db = await readyDb();
  const docs = await db
    .collection<CommentDoc>("comments")
    .find({ postId: new ObjectId(postId) })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  const authorMap = await authorInfoFor([
    ...new Set(docs.map((d) => d.authorId)),
  ]);
  const comments = docs.map((d) => toComment(d, authorMap.get(d.authorId)));

  const threads: CommentThread[] = [];
  const threadsById = new Map<string, CommentThread>();
  for (const comment of comments) {
    if (comment.parentId === null) {
      const thread: CommentThread = { ...comment, replies: [] };
      threadsById.set(comment.id, thread);
      threads.push(thread);
    } else {
      const parent = threadsById.get(comment.parentId);
      if (parent) {
        parent.replies.push(comment);
      } else {
        // Orphaned reply (parent deleted conceptually): promote to top level.
        const thread: CommentThread = { ...comment, parentId: null, replies: [] };
        threadsById.set(comment.id, thread);
        threads.push(thread);
      }
    }
  }
  return threads;
}

/**
 * Adds a comment. Replies to a reply are flattened to the top-level
 * parent so threads stay one level deep.
 */
export async function addComment(input: {
  postId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  text: string;
}): Promise<Comment> {
  const db = await readyDb();
  if (!ObjectId.isValid(input.postId)) {
    throw new Error("Invalid post id");
  }
  const pid = new ObjectId(input.postId);

  const post = await db
    .collection<{ _id: ObjectId }>("posts")
    .findOne({ _id: pid }, { projection: { _id: 1 } });
  if (!post) {
    throw new Error("Post not found");
  }

  let parentId: ObjectId | null = null;
  if (input.parentId && ObjectId.isValid(input.parentId)) {
    const parent = await db
      .collection<CommentDoc>("comments")
      .findOne({ _id: new ObjectId(input.parentId) });
    if (parent && parent.postId.equals(pid)) {
      parentId = parent.parentId ?? parent._id;
    }
  }

  const now = new Date();
  const result = await db.collection<CommentDoc>("comments").insertOne({
    postId: pid,
    parentId,
    authorId: input.authorId,
    authorName: input.authorName,
    text: input.text,
    createdAt: now,
  });

  await db
    .collection("posts")
    .updateOne({ _id: pid }, { $inc: { commentsCount: 1 } });

  const authorMap = await authorInfoFor([input.authorId]);
  return toComment(
    {
      _id: result.insertedId,
      postId: pid,
      parentId,
      authorId: input.authorId,
      authorName: input.authorName,
      text: input.text,
      createdAt: now,
    },
    authorMap.get(input.authorId),
  );
}

/** A user's comments (newest first) with the parent post for context. */
export async function getCommentsByAuthor(
  authorId: string,
  cursor?: string | null,
): Promise<{ comments: UserComment[]; nextCursor: string | null }> {
  const db = await readyDb();
  const query = {
    authorId,
    ...(cursor && ObjectId.isValid(cursor)
      ? { _id: { $lt: new ObjectId(cursor) } }
      : {}),
  };

  const docs = await db
    .collection<CommentDoc>("comments")
    .find(query)
    .sort({ _id: -1 })
    .limit(COMMENTS_PAGE_SIZE + 1)
    .toArray();

  const hasMore = docs.length > COMMENTS_PAGE_SIZE;
  const page = hasMore ? docs.slice(0, COMMENTS_PAGE_SIZE) : docs;

  const postMap = new Map<string, { id: string; authorName: string; snippet: string }>();
  const postIds = [...new Set(page.map((d) => d.postId))];
  if (postIds.length > 0) {
    const posts = await db
      .collection<{ _id: ObjectId; authorName: string; text: string }>("posts")
      .find({ _id: { $in: postIds } })
      .project<{ _id: ObjectId; authorName: string; text: string }>({
        authorName: 1,
        text: 1,
      })
      .toArray();
    for (const p of posts) {
      postMap.set(p._id.toHexString(), {
        id: p._id.toHexString(),
        authorName: p.authorName,
        snippet: p.text.slice(0, 80),
      });
    }
  }

  const authorMap = await authorInfoFor([authorId]);
  const me = authorMap.get(authorId);

  return {
    comments: page.map((d) => ({
      ...toComment(d, me),
      post: postMap.get(d.postId.toHexString()) ?? null,
    })),
    nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null,
  };
}
