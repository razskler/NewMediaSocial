/**
 * Individual bot behaviors for the live daemon. Every action writes
 * through the same src/lib functions the app's Server Actions use.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../src/lib/mongo";
import { createPost, toggleLike } from "../src/lib/posts";
import { addComment } from "../src/lib/comments";
import { followedUserIds, toggleFollow } from "../src/lib/follows";
import { generateComment, generatePost, generateReply } from "./content";
import { randomFrom } from "./personas";
import type { BotRecord } from "./registry";

type PostRow = { _id: ObjectId; authorId: string; authorName: string; text: string };
type CommentRow = { _id: ObjectId; postId: ObjectId; authorId: string; authorName: string; text: string };

async function recentPosts(limit: number): Promise<PostRow[]> {
  const db = await getDb();
  return db
    .collection<PostRow>("posts")
    .find({}, { projection: { authorId: 1, authorName: 1, text: 1 } })
    .sort({ _id: -1 })
    .limit(limit)
    .toArray();
}

export async function botCreatePost(bot: BotRecord): Promise<void> {
  const recent = await recentPosts(10);
  const text = await generatePost(
    bot.persona,
    recent.map((p) => ({ authorName: p.authorName, text: p.text })),
  );
  const post = await createPost({
    authorId: bot.userId,
    authorName: bot.displayName,
    text,
  });
  console.log(`[bots] @${bot.username} posted "${text.slice(0, 60)}" (${post.id})`);
}

export async function botLike(bot: BotRecord): Promise<void> {
  const db = await getDb();
  const candidates = await recentPosts(40);
  const eligible = candidates.filter((p) => p.authorId !== bot.userId);
  if (eligible.length === 0) {
    return;
  }
  const alreadyLiked = new Set(
    (
      await db
        .collection<{ postId: ObjectId }>("likes")
        .find(
          { userId: bot.userId, postId: { $in: eligible.map((p) => p._id) } },
          { projection: { postId: 1 } },
        )
        .toArray()
    ).map((l) => l.postId.toHexString()),
  );
  const target = eligible.filter((p) => !alreadyLiked.has(p._id.toHexString()));
  if (target.length === 0) {
    return;
  }
  const post = randomFrom(target);
  await toggleLike(post._id.toHexString(), bot.userId);
  console.log(`[bots] @${bot.username} liked ${post._id.toHexString()} by ${post.authorName}`);
}

export async function botComment(bot: BotRecord): Promise<void> {
  const candidates = (await recentPosts(30)).filter(
    (p) => p.authorId !== bot.userId,
  );
  if (candidates.length === 0) {
    return;
  }
  const post = randomFrom(candidates);
  const text = await generateComment(bot.persona, {
    authorName: post.authorName,
    text: post.text,
  });
  const comment = await addComment({
    postId: post._id.toHexString(),
    parentId: null,
    authorId: bot.userId,
    authorName: bot.displayName,
    text,
  });
  console.log(
    `[bots] @${bot.username} commented on ${post._id.toHexString()}: "${text.slice(0, 50)}" (${comment.id})`,
  );
}

export async function botReply(bot: BotRecord): Promise<void> {
  const db = await getDb();
  const candidates = await db
    .collection<CommentRow>("comments")
    .find(
      {},
      { projection: { postId: 1, authorId: 1, authorName: 1, text: 1 } },
    )
    .sort({ _id: -1 })
    .limit(30)
    .toArray();
  const eligible = candidates.filter((c) => c.authorId !== bot.userId);
  if (eligible.length === 0) {
    return;
  }
  const parent = randomFrom(eligible);
  const text = await generateReply(bot.persona, {
    authorName: parent.authorName,
    text: parent.text,
  });
  await addComment({
    postId: parent.postId.toHexString(),
    parentId: parent._id.toHexString(),
    authorId: bot.userId,
    authorName: bot.displayName,
    text,
  });
  console.log(
    `[bots] @${bot.username} replied to ${parent.authorName}'s comment: "${text.slice(0, 50)}"`,
  );
}

export async function botFollow(bot: BotRecord): Promise<void> {
  const db = await getDb();
  const alreadyFollowing = new Set(await followedUserIds(bot.userId));
  const candidates = await db
    .collection<{ userId: string; username: string }>("profiles")
    .find(
      { userId: { $ne: bot.userId, $nin: [...alreadyFollowing] } },
      { projection: { userId: 1, username: 1 } },
    )
    .limit(50)
    .toArray();
  if (candidates.length === 0) {
    return;
  }
  const target = randomFrom(candidates);
  await toggleFollow(bot.userId, target.userId);
  console.log(`[bots] @${bot.username} followed @${target.username}`);
}
