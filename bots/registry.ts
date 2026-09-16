/**
 * Bot account registry.
 *
 * Bots are real GoTrue users (created over the internal auth API, with
 * deterministic passwords) plus a profile, tracked in a `bots` Mongo
 * collection so seeding is idempotent and the daemon can look them up.
 */

import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { getDb } from "../src/lib/mongo";
import {
  UsernameTakenError,
  createProfile,
} from "../src/lib/profiles";
import { botEnv } from "./env";
import { personasForCount, type Persona } from "./personas";

export type BotRecord = {
  username: string;
  userId: string;
  email: string;
  displayName: string;
  persona: Persona;
  createdAt: string;
};

type BotDoc = Omit<BotRecord, "createdAt" | "persona"> & {
  persona: Persona;
  createdAt: Date;
};

/** Same input always yields the same password, across runs and containers. */
export function botPassword(username: string): string {
  return createHash("sha256")
    .update(`${username}:${botEnv.passwordSecret}`)
    .digest("hex")
    .slice(0, 24);
}

async function gotrue(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${botEnv.authUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: botEnv.anonKey,
      authorization: `Bearer ${botEnv.anonKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (json.msg as string | undefined) ??
      (json.error as string | undefined) ??
      `HTTP ${res.status}`;
    throw new Error(`GoTrue ${path} failed: ${msg}`);
  }
  return json;
}

function userIdFrom(json: Record<string, unknown>): string | null {
  const user = json.user as { id?: string } | undefined;
  return user?.id ?? (json.id as string | undefined) ?? null;
}

/** Creates the GoTrue user (or resolves the existing one) for a persona. */
async function ensureAuthUser(persona: Persona): Promise<string> {
  const email = `${persona.username}@bots.local`;
  const password = botPassword(persona.username);

  try {
    const json = await gotrue("/signup", {
      email,
      password,
      data: {
        username: persona.username,
        display_name: persona.displayName,
      },
    });
    const id = userIdFrom(json);
    if (id) {
      return id;
    }
    throw new Error("signup response contained no user id");
  } catch (err) {
    // "already registered" is expected on re-runs without a registry row —
    // log in with the same deterministic password to recover the user id.
    if (
      /already|exists|registered/i.test(String((err as Error).message)) ===
      false
    ) {
      throw err;
    }
  }

  const json = await gotrue("/token?grant_type=password", { email, password });
  const id = userIdFrom(json);
  if (!id) {
    throw new Error(`login for ${email} returned no user id`);
  }
  return id;
}

async function readyCollection() {
  const db = await getDb();
  await db.collection("bots").createIndex({ username: 1 }, { unique: true });
  return db.collection<BotDoc>("bots");
}

/** Bot docs only — the collection also holds the seed marker doc. */
const BOT_FILTER = { kind: { $ne: "meta" } } as const;

/** Creates bot accounts until `count` exist in the registry. Idempotent. */
export async function ensureBots(count: number): Promise<BotRecord[]> {
  const collection = await readyCollection();

  const existing = await collection
    .find(BOT_FILTER)
    .sort({ username: 1 })
    .toArray()
    .then((docs) => docs.map(toRecord));

  const wanted = personasForCount(count);
  const known = new Set(existing.map((b) => b.username));
  const missing = wanted.filter((p) => !known.has(p.username));

  for (const persona of missing) {
    const userId = await ensureAuthUser(persona);

    // Profile: createProfile tolerates an existing profile for the same
    // user id; username conflicts fall back to a suffixed variant.
    let username = persona.username;
    try {
      await createProfile({
        userId,
        username,
        displayName: persona.displayName,
        bio: persona.bio,
      });
    } catch (err) {
      if (err instanceof UsernameTakenError) {
        username = `${persona.username.slice(0, 16)}_${Math.random()
          .toString(36)
          .slice(2, 5)}`;
        await createProfile({
          userId,
          username,
          displayName: persona.displayName,
          bio: persona.bio,
        });
      } else {
        throw err;
      }
    }

    await collection.insertOne({
      username,
      userId,
      email: `${persona.username}@bots.local`,
      displayName: persona.displayName,
      persona: { ...persona, username },
      createdAt: new Date(),
    });
    console.log(`[bots] created @${username} (${userId})`);
  }

  if (missing.length === 0) {
    console.log(`[bots] ${existing.length} bot accounts already registered`);
  }

  const all = await collection.find(BOT_FILTER).sort({ username: 1 }).toArray();
  return all.map(toRecord);
}

export async function listBots(): Promise<BotRecord[]> {
  const collection = await readyCollection();
  const docs = await collection.find(BOT_FILTER).sort({ username: 1 }).toArray();
  return docs.map(toRecord);
}

export async function seedMarker(): Promise<Date | null> {
  const db = await getDb();
  const doc = await db
    .collection("bots")
    .findOne({ kind: "meta" });
  const seededAt = doc?.seededAt;
  return seededAt instanceof Date ? seededAt : null;
}

export async function setSeedMarker(): Promise<void> {
  const db = await getDb();
  await db
    .collection("bots")
    .updateOne(
      { kind: "meta" },
      { $set: { kind: "meta", seededAt: new Date() } },
      { upsert: true },
    );
}

export async function clearSeedMarker(): Promise<void> {
  const db = await getDb();
  await db.collection("bots").deleteOne({ kind: "meta" });
}

/**
 * Removes everything the bots ever wrote: their posts, likes and comments
 * (on anyone's content, fixing denormalized counters), follows, profiles
 * and the registry itself. GoTrue auth users are left behind as inert
 * orphans — they are invisible without a profile.
 */
export async function purgeBotData(): Promise<void> {
  const bots = await listBots();
  const botIds = bots.map((b) => b.userId);
  if (botIds.length === 0) {
    console.log("[bots] nothing to purge");
    return;
  }

  const db = await getDb();
  const botPostIds = await db
    .collection("posts")
    .find({ authorId: { $in: botIds } }, { projection: { _id: 1 } })
    .map((d) => d._id as ObjectId)
    .toArray();

  // Decrement denormalized counters on real posts the bots engaged with,
  // then delete every row the bots authored or that points at bot posts.
  const foreignLikeCounts = await db
    .collection("likes")
    .aggregate<{ _id: ObjectId; n: number }>([
      { $match: { userId: { $in: botIds }, postId: { $nin: botPostIds } } },
      { $group: { _id: "$postId", n: { $sum: 1 } } },
    ])
    .toArray();
  for (const row of foreignLikeCounts) {
    await db
      .collection("posts")
      .updateOne({ _id: row._id }, { $inc: { likesCount: -row.n } });
  }

  const foreignCommentCounts = await db
    .collection("comments")
    .aggregate<{ _id: ObjectId; n: number }>([
      { $match: { authorId: { $in: botIds }, postId: { $nin: botPostIds } } },
      { $group: { _id: "$postId", n: { $sum: 1 } } },
    ])
    .toArray();
  for (const row of foreignCommentCounts) {
    await db
      .collection("posts")
      .updateOne({ _id: row._id }, { $inc: { commentsCount: -row.n } });
  }

  const deletions: [string, Record<string, unknown>][] = [
    ["likes", { $or: [{ userId: { $in: botIds } }, { postId: { $in: botPostIds } }] }],
    [
      "comments",
      { $or: [{ authorId: { $in: botIds } }, { postId: { $in: botPostIds } }] },
    ],
    ["posts", { authorId: { $in: botIds } }],
    [
      "follows",
      {
        $or: [{ followerId: { $in: botIds } }, { followeeId: { $in: botIds } }],
      },
    ],
    ["profiles", { userId: { $in: botIds } }],
  ];
  for (const [name, filter] of deletions) {
    const res = await db.collection(name).deleteMany(filter as never);
    console.log(`[bots] deleted ${res.deletedCount} from ${name}`);
  }

  await db.collection("bots").deleteMany({});
  console.log(`[bots] purged ${bots.length} bot accounts`);
}

function toRecord(d: BotDoc): BotRecord {
  return {
    username: d.username,
    userId: d.userId,
    email: d.email,
    displayName: d.displayName,
    persona: d.persona,
    createdAt: d.createdAt.toISOString(),
  };
}
