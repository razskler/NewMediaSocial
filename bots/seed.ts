/**
 * One-shot seeding: creates bot accounts (if missing), a follow graph,
 * and a backdated history of posts, likes and comments spread over
 * BOT_SEED_DAYS. Idempotent — a marker in the `bots` collection skips
 * the backfill on re-runs unless `force` is set.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../src/lib/mongo";
import { createPost, toggleLike } from "../src/lib/posts";
import { addComment } from "../src/lib/comments";
import { toggleFollow } from "../src/lib/follows";
import { generatePost, templatePostFor } from "./content";
import { botEnv } from "./env";
import { TEMPLATE_COMMENTS, randomFrom } from "./personas";
import {
  clearSeedMarker,
  ensureBots,
  listBots,
  seedMarker,
  setSeedMarker,
  type BotRecord,
} from "./registry";

/** Global pool of used seconds — backdated _ids must never collide. */
const usedSeconds = new Set<number>();

function uniqueSecond(minSec: number, maxSec: number): number {
  const lo = Math.min(minSec, maxSec);
  const hi = Math.max(minSec, maxSec);
  for (let i = 0; i < 100; i += 1) {
    const sec = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (!usedSeconds.has(sec)) {
      usedSeconds.add(sec);
      return sec;
    }
  }
  let sec = hi;
  while (usedSeconds.has(sec) && sec > lo) {
    sec -= 1;
  }
  usedSeconds.add(sec);
  return sec;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Runs fn over items with limited concurrency. */
async function mapLimited<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn));
  }
}

/** createPost with a retry for rare _id collisions with real posts. */
async function createBackdatedPost(
  bot: BotRecord,
  text: string,
  sec: number,
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const post = await createPost({
        authorId: bot.userId,
        authorName: bot.displayName,
        text,
        createdAt: new Date(sec * 1000),
      });
      return post.id;
    } catch (err) {
      if (
        (err as { code?: number }).code === 11000 ||
        /duplicate key/i.test(String((err as Error).message))
      ) {
        usedSeconds.add(sec);
        sec = uniqueSecond(sec, sec + 3600);
        continue;
      }
      throw err;
    }
  }
  throw new Error("could not allocate a unique post id");
}

async function seedFollowGraph(bots: BotRecord[]): Promise<void> {
  const db = await getDb();
  const botIds = new Set(bots.map((b) => b.userId));

  const realUsers = await db
    .collection<{ userId: string }>("profiles")
    .find({ userId: { $nin: [...botIds] } }, { projection: { userId: 1 } })
    .limit(100)
    .toArray();

  let edges = 0;
  for (const bot of bots) {
    const others = shuffled(bots.filter((b) => b.userId !== bot.userId));
    const targets: { userId: string }[] = others.slice(0, randInt(3, 10));
    // About half the bots also follow one real user, if any exist.
    if (realUsers.length > 0 && Math.random() < 0.5) {
      targets.push({ userId: randomFrom(realUsers).userId });
    }
    for (const target of targets) {
      await toggleFollow(bot.userId, target.userId);
      edges += 1;
    }
  }
  console.log(`[bots] follow graph: ${edges} edges`);
}

async function seedPosts(bots: BotRecord[]): Promise<{ id: string; sec: number; authorId: string }[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = nowSec - botEnv.seedDays * 86_400;
  const results: { id: string; sec: number; authorId: string }[] = [];

  type PendingPost = { bot: BotRecord; sec: number };
  const pending: PendingPost[] = [];
  for (let i = 0; i < botEnv.seedPosts; i += 1) {
    pending.push({
      bot: randomFrom(bots),
      sec: uniqueSecond(startSec, nowSec - 60),
    });
  }

  const useLlm = botEnv.seedWithLlm && botEnv.llmApiKey !== null;
  const concurrency = useLlm ? 4 : 8;
  let done = 0;

  await mapLimited(pending, concurrency, async ({ bot, sec }) => {
    const text = useLlm
      ? await generatePost(bot.persona, [])
      : templatePostFor(bot.persona);
    const id = await createBackdatedPost(bot, text, sec);
    results.push({ id, sec, authorId: bot.userId });
    done += 1;
    if (done % 50 === 0) {
      console.log(`[bots] seeded ${done}/${pending.length} posts`);
    }
  });

  console.log(`[bots] created ${results.length} posts over ${botEnv.seedDays} days`);
  return results;
}

async function seedEngagement(
  bots: BotRecord[],
  posts: { id: string; sec: number; authorId: string }[],
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  let likeRows = 0;
  let commentRows = 0;

  for (const post of posts) {
    const roll = Math.random();
    const likeCount =
      roll < 0.55 ? randInt(0, 2) : roll < 0.85 ? randInt(2, 8) : randInt(8, 20);
    const likers = shuffled(bots.filter((b) => b.userId !== post.authorId)).slice(
      0,
      likeCount,
    );
    for (const bot of likers) {
      const sec = uniqueSecond(post.sec + 60, nowSec - 1);
      await toggleLike(post.id, bot.userId, new Date(sec * 1000));
      likeRows += 1;
    }

    if (Math.random() >= 0.5) {
      const commentCount = randInt(1, 4);
      const commenters = shuffled(
        bots.filter((b) => b.userId !== post.authorId),
      ).slice(0, commentCount);
      for (const bot of commenters) {
        const sec = uniqueSecond(post.sec + 120, nowSec - 1);
        await addComment({
          postId: post.id,
          parentId: null,
          authorId: bot.userId,
          authorName: bot.displayName,
          text: randomFrom(TEMPLATE_COMMENTS),
          createdAt: new Date(sec * 1000),
        });
        commentRows += 1;
      }
    }
  }

  // Sprinkle engagement onto real users' recent posts too, so a fresh
  // real account immediately sees likes and comments on its content.
  const db = await getDb();
  const botIds = bots.map((b) => b.userId);
  const realPosts = await db
    .collection<{ _id: ObjectId; authorId: string; createdAt: Date }>("posts")
    .find({ authorId: { $nin: botIds } }, { projection: { authorId: 1, createdAt: 1 } })
    .sort({ _id: -1 })
    .limit(50)
    .toArray();

  for (const post of realPosts) {
    const postId = post._id.toHexString();
    const postSec = Math.floor(post.createdAt.getTime() / 1000);
    for (const bot of shuffled(bots).slice(0, randInt(1, 5))) {
      const sec = uniqueSecond(postSec + 60, nowSec - 1);
      await toggleLike(postId, bot.userId, new Date(sec * 1000));
      likeRows += 1;
    }
    if (Math.random() < 0.4) {
      const bot = randomFrom(bots);
      const sec = uniqueSecond(postSec + 120, nowSec - 1);
      await addComment({
        postId,
        parentId: null,
        authorId: bot.userId,
        authorName: bot.displayName,
        text: randomFrom(TEMPLATE_COMMENTS),
        createdAt: new Date(sec * 1000),
      });
      commentRows += 1;
    }
  }

  console.log(
    `[bots] engagement seeded: ${likeRows} likes, ${commentRows} comments`,
  );
}

export async function runSeed(options: { force?: boolean } = {}): Promise<void> {
  if (!options.force && (await seedMarker()) !== null) {
    console.log("[bots] already seeded (marker present) — skipping");
    return;
  }
  await clearSeedMarker();

  console.log(
    `[bots] seeding ${botEnv.count} bots, ${botEnv.seedPosts} posts over ${botEnv.seedDays} days`,
  );
  const bots = await ensureBots(botEnv.count);
  if (bots.length === 0) {
    throw new Error("no bots were created");
  }

  await seedFollowGraph(bots);
  const posts = await seedPosts(bots);
  await seedEngagement(bots, posts);
  await setSeedMarker();
  console.log("[bots] seed complete");
}
