import { ObjectId, type Db, type Filter, type WithId } from "mongodb";
import { getDb } from "./mongo";
import { authorInfoFor } from "./profiles";

export const CONVERSATIONS_PAGE_SIZE = 20;
export const MAX_CONVERSATION_PARTICIPANTS = 10;

export type ConversationParticipant = {
  userId: string;
  username: string | null;
  displayName: string;
  avatarMediaId: string | null;
};

export type Conversation = {
  id: string;
  isGroup: boolean;
  title: string;
  titleCustom: string | null;
  createdBy: string;
  participants: ConversationParticipant[];
  lastMessagePreview: {
    senderId: string;
    text: string;
    createdAt: string;
  } | null;
  lastMessageAt: string;
  createdAt: string;
};

type LastMessagePreviewDoc = {
  text: string;
  senderId: string;
  createdAt: Date;
};

type ConversationDoc = {
  participantIds: string[];
  key?: string;
  isGroup: boolean;
  title: string | null;
  createdBy: string;
  lastMessageAt: Date;
  lastMessagePreview: LastMessagePreviewDoc | null;
  createdAt: Date;
};

let indexesReady: Promise<void> | null = null;

async function readyDb(): Promise<Db> {
  const db = await getDb();
  if (!indexesReady) {
    indexesReady = Promise.all([
      db
        .collection<ConversationDoc>("conversations")
        .createIndex({ key: 1 }, { unique: true, sparse: true }),
      db.collection<ConversationDoc>("conversations").createIndex({
        participantIds: 1,
        lastMessageAt: -1,
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

function conversationTitle(
  doc: WithId<ConversationDoc>,
  viewerId: string,
  participants: ConversationParticipant[],
): string {
  if (doc.isGroup) {
    if (doc.title) {
      return doc.title;
    }
    const others = participants
      .filter((p) => p.userId !== viewerId)
      .map((p) => p.displayName);
    if (others.length === 0) {
      return "Only you";
    }
    const shown = others.slice(0, 3).join(", ");
    return others.length > 3 ? `${shown} +${others.length - 3}` : shown;
  }
  const other = participants.find((p) => p.userId !== viewerId);
  return other?.displayName ?? "Direct message";
}

function toConversation(
  doc: WithId<ConversationDoc>,
  viewerId: string,
  infoMap: Map<
    string,
    { username: string; displayName: string; avatarMediaId: string | null }
  >,
): Conversation {
  const participants: ConversationParticipant[] = doc.participantIds.map(
    (id) => {
      const info = infoMap.get(id);
      return {
        userId: id,
        username: info?.username ?? null,
        displayName: info?.displayName ?? "Someone",
        avatarMediaId: info?.avatarMediaId ?? null,
      };
    },
  );
  return {
    id: doc._id.toHexString(),
    isGroup: doc.isGroup,
    title: conversationTitle(doc, viewerId, participants),
    titleCustom: doc.title,
    createdBy: doc.createdBy,
    participants,
    lastMessagePreview: doc.lastMessagePreview
      ? {
          senderId: doc.lastMessagePreview.senderId,
          text: doc.lastMessagePreview.text,
          createdAt: doc.lastMessagePreview.createdAt.toISOString(),
        }
      : null,
    lastMessageAt: doc.lastMessageAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function createConversation(input: {
  creatorId: string;
  participantIds: string[];
  title?: string | null;
}): Promise<Conversation> {
  const db = await readyDb();
  const participantIds = [
    ...new Set([input.creatorId, ...input.participantIds]),
  ].sort();
  const isGroup = participantIds.length > 2;
  const key = isGroup ? undefined : participantIds.join(":");

  if (!isGroup) {
    const existing = await db
      .collection<ConversationDoc>("conversations")
      .findOne({ key });
    if (existing) {
      return toConversation(
        existing,
        input.creatorId,
        await authorInfoFor(participantIds),
      );
    }
  }

  const now = new Date();
  const doc: ConversationDoc = {
    participantIds,
    ...(key ? { key } : {}),
    isGroup,
    title: isGroup ? input.title?.trim() || null : null,
    createdBy: input.creatorId,
    lastMessageAt: now,
    lastMessagePreview: null,
    createdAt: now,
  };

  let insertedId: ObjectId;
  try {
    const result = await db
      .collection<ConversationDoc>("conversations")
      .insertOne(doc);
    insertedId = result.insertedId;
  } catch (err) {
    if ((err as { code?: number }).code === 11000 && key) {
      const existing = await db
        .collection<ConversationDoc>("conversations")
        .findOne({ key });
      if (existing) {
        return toConversation(
          existing,
          input.creatorId,
          await authorInfoFor(participantIds),
        );
      }
    }
    throw err;
  }

  return toConversation(
    { ...doc, _id: insertedId },
    input.creatorId,
    await authorInfoFor(participantIds),
  );
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
): Promise<Conversation | null> {
  if (!ObjectId.isValid(conversationId)) {
    return null;
  }
  const db = await readyDb();
  const doc = await db.collection<ConversationDoc>("conversations").findOne({
    _id: new ObjectId(conversationId),
    participantIds: userId,
  });
  if (!doc) {
    return null;
  }
  return toConversation(
    doc,
    userId,
    await authorInfoFor(doc.participantIds),
  );
}

function parseConversationCursor(
  cursor: string | null,
): { lastMessageAt: Date; id: ObjectId } | null {
  if (!cursor) {
    return null;
  }
  const [iso, id] = cursor.split("|");
  if (!iso || !id || !ObjectId.isValid(id)) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return { lastMessageAt: date, id: new ObjectId(id) };
}

export async function listConversations(
  userId: string,
  cursor: string | null,
): Promise<{ conversations: Conversation[]; nextCursor: string | null }> {
  const db = await readyDb();
  const parsed = parseConversationCursor(cursor);
  const query: Filter<ConversationDoc> = {
    participantIds: userId,
    ...(parsed
      ? {
          $or: [
            { lastMessageAt: { $lt: parsed.lastMessageAt } },
            { lastMessageAt: parsed.lastMessageAt, _id: { $lt: parsed.id } },
          ],
        }
      : {}),
  };

  const docs = await db
    .collection<ConversationDoc>("conversations")
    .find(query)
    .sort({ lastMessageAt: -1, _id: -1 })
    .limit(CONVERSATIONS_PAGE_SIZE + 1)
    .toArray();

  const hasMore = docs.length > CONVERSATIONS_PAGE_SIZE;
  const page = hasMore ? docs.slice(0, CONVERSATIONS_PAGE_SIZE) : docs;
  const infoMap = await authorInfoFor([
    ...new Set(page.flatMap((d) => d.participantIds)),
  ]);
  const last = page[page.length - 1];

  return {
    conversations: page.map((d) => toConversation(d, userId, infoMap)),
    nextCursor:
      hasMore && last
        ? `${last.lastMessageAt.toISOString()}|${last._id.toHexString()}`
        : null,
  };
}

