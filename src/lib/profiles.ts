import type { Db } from "mongodb";
import { getDb } from "./mongo";
import { authorNameFromUser } from "./user";

export type Profile = {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarMediaId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProfileDoc = {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarMediaId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is already taken.");
    this.name = "UsernameTakenError";
  }
}

// Route/namespace words that would collide with real paths.
const RESERVED_USERNAMES = new Set([
  "login",
  "register",
  "settings",
  "api",
  "u",
  "admin",
  "root",
  "newmediasocial",
]);

let indexesReady: Promise<void> | null = null;

async function readyDb(): Promise<Db> {
  const db = await getDb();
  if (!indexesReady) {
    indexesReady = Promise.all([
      db.collection<ProfileDoc>("profiles").createIndex(
        { userId: 1 },
        { unique: true },
      ),
      db.collection<ProfileDoc>("profiles").createIndex(
        { username: 1 },
        { unique: true },
      ),
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

function toProfile(d: ProfileDoc): Profile {
  return {
    userId: d.userId,
    username: d.username,
    displayName: d.displayName,
    bio: d.bio,
    avatarMediaId: d.avatarMediaId,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export async function getProfileByUserId(
  userId: string,
): Promise<Profile | null> {
  const db = await readyDb();
  const doc = await db
    .collection<ProfileDoc>("profiles")
    .findOne({ userId });
  return doc ? toProfile(doc) : null;
}

export async function getProfileByUsername(
  username: string,
): Promise<Profile | null> {
  const db = await readyDb();
  const doc = await db
    .collection<ProfileDoc>("profiles")
    .findOne({ username: username.toLowerCase() });
  return doc ? toProfile(doc) : null;
}

export async function usernameAvailable(username: string): Promise<boolean> {
  const lower = username.toLowerCase();
  if (RESERVED_USERNAMES.has(lower)) {
    return false;
  }
  const db = await readyDb();
  const existing = await db
    .collection<ProfileDoc>("profiles")
    .findOne({ username: lower }, { projection: { _id: 1 } });
  return existing === null;
}

/**
 * Creates a profile. Throws UsernameTakenError if the username is claimed;
 * returns the existing profile if this user already has one.
 */
export async function createProfile(input: {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
}): Promise<Profile> {
  const db = await readyDb();
  const username = input.username.toLowerCase();
  const now = new Date();
  try {
    await db.collection<ProfileDoc>("profiles").insertOne({
      userId: input.userId,
      username,
      displayName: input.displayName,
      bio: input.bio ?? "",
      avatarMediaId: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 11000) {
      const keyPattern = (err as { keyPattern?: Record<string, unknown> })
        .keyPattern;
      if (keyPattern && "username" in keyPattern) {
        throw new UsernameTakenError();
      }
      const existing = await db
        .collection<ProfileDoc>("profiles")
        .findOne({ userId: input.userId });
      if (existing) {
        return toProfile(existing);
      }
    }
    throw err;
  }
  return {
    userId: input.userId,
    username,
    displayName: input.displayName,
    bio: input.bio ?? "",
    avatarMediaId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function updateProfile(
  userId: string,
  patch: { bio?: string; avatarMediaId?: string | null },
): Promise<Profile | null> {
  const db = await readyDb();
  const set: Partial<ProfileDoc> = { updatedAt: new Date() };
  if (patch.bio !== undefined) {
    set.bio = patch.bio;
  }
  if (patch.avatarMediaId !== undefined) {
    set.avatarMediaId = patch.avatarMediaId;
  }
  const doc = await db
    .collection<ProfileDoc>("profiles")
    .findOneAndUpdate({ userId }, { $set: set }, { returnDocument: "after" });
  return doc ? toProfile(doc) : null;
}

/**
 * Batch lookup used to join author identity (username for profile links,
 * avatar shown live) onto posts and comments. Falls back to `undefined`
 * for authors without a profile yet.
 */
export async function authorInfoFor(
  userIds: string[],
): Promise<Map<string, { username: string; avatarMediaId: string | null }>> {
  if (userIds.length === 0) {
    return new Map();
  }
  const db = await readyDb();
  const docs = await db
    .collection<ProfileDoc>("profiles")
    .find({ userId: { $in: userIds } })
    .project<{ userId: string; username: string; avatarMediaId: string | null }>(
      { userId: 1, username: 1, avatarMediaId: 1 },
    )
    .toArray();
  return new Map(
    docs.map((d) => [d.userId, { username: d.username, avatarMediaId: d.avatarMediaId }]),
  );
}

/**
 * Returns the user's profile, creating one on first visit from GoTrue
 * metadata. New signups carry `username` in metadata; legacy accounts
 * (no metadata username) return null and use the one-time setup flow.
 */
export async function ensureProfileFromMetadata(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): Promise<Profile | null> {
  const existing = await getProfileByUserId(user.id);
  if (existing) {
    return existing;
  }

  const raw = user.user_metadata?.username;
  if (typeof raw !== "string") {
    return null;
  }
  const username = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return null;
  }

  try {
    return await createProfile({
      userId: user.id,
      username,
      displayName: authorNameFromUser(user),
    });
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      // Someone claimed the username between signup and now: fall back
      // to a suffixed variant so the account still gets its profile.
      const fallback = `${username.slice(0, 16)}_${Math.random()
        .toString(36)
        .slice(2, 5)}`;
      return await createProfile({
        userId: user.id,
        username: fallback,
        displayName: authorNameFromUser(user),
      });
    }
    throw err;
  }
}
