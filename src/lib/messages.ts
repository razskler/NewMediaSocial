import { ObjectId, type Db, type WithId } from "mongodb";
import { getDb } from "./mongo";
import { authorInfoFor } from "./profiles";
import { dmEventBus, dmUserEventName } from "./events";

export const MESSAGES_PAGE_SIZE = 30;

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderUsername: string | null;
  senderAvatarMediaId: string | null;
  text: string | null;
  mediaIds: string[];
  deleted: boolean;
  createdAt: string;
};

export type DmEvent =
  | { type: "message_sent"; conversationId: string; message: Message }
  | {
      type: "message_deleted";
      conversationId: string;
      messageId: string;
    };

type MessageDoc = {
  conversationId: ObjectId;
  senderId: string;
  senderName: string;
  text: string;
  mediaIds: ObjectId[];
  deletedAt: Date | null;
  createdAt: Date;
};

let indexesReady: Promise<void> | null = null;

async function readyDb(): Promise<Db> {
  const db = await getDb();
  if (!indexesReady) {
    indexesReady = db
      .collection<MessageDoc>("messages")
      .createIndex({ conversationId: 1, _id: -1 })
      .then(() => undefined)
      .catch((err) => {
        indexesReady = null;
        throw err;
      });
  }
  await indexesReady;
  return db;
}

function toMessage(
  d: WithId<MessageDoc>,
  author:
    | { username: string; avatarMediaId: string | null }
    | undefined,
): Message {
  const deleted = d.deletedAt !== null;
  return {
    id: d._id.toHexString(),
    conversationId: d.conversationId.toHexString(),
    senderId: d.senderId,
    senderName: d.senderName,
    senderUsername: author?.username ?? null,
    senderAvatarMediaId: author?.avatarMediaId ?? null,
    text: deleted ? null : d.text,
    mediaIds: deleted ? [] : d.mediaIds.map((m) => m.toHexString()),
    deleted,
    createdAt: d.createdAt.toISOString(),
  };
}

function publishDmEvent(participantIds: string[], event: DmEvent) {
  const bus = dmEventBus();
  for (const userId of participantIds) {
    bus.emit(dmUserEventName(userId), event);
  }
}

export async function listMessages(
  conversationId: string,
  cursor: string | null,
): Promise<{ messages: Message[]; nextCursor: string | null }> {
  if (!ObjectId.isValid(conversationId)) {
    return { messages: [], nextCursor: null };
  }
  const db = await readyDb();
  const docs = await db
    .collection<MessageDoc>("messages")
    .find({
      conversationId: new ObjectId(conversationId),
      ...(cursor && ObjectId.isValid(cursor)
        ? { _id: { $lt: new ObjectId(cursor) } }
        : {}),
    })
    .sort({ _id: -1 })
    .limit(MESSAGES_PAGE_SIZE + 1)
    .toArray();

  const hasMore = docs.length > MESSAGES_PAGE_SIZE;
  const page = hasMore ? docs.slice(0, MESSAGES_PAGE_SIZE) : docs;
  const authorMap = await authorInfoFor([
    ...new Set(page.map((d) => d.senderId)),
  ]);

  return {
    messages: page.map((d) => toMessage(d, authorMap.get(d.senderId))),
    nextCursor: hasMore ? page[page.length - 1]._id.toHexString() : null,
  };
}

export async function getMessageForSender(
  messageId: ObjectId,
  senderId: string,
): Promise<{ conversationId: ObjectId } | null> {
  const db = await readyDb();
  const doc = await db
    .collection<MessageDoc>("messages")
    .findOne(
      { _id: messageId, senderId },
      { projection: { conversationId: 1 } },
    );
  return doc ? { conversationId: doc.conversationId } : null;
}

export async function addMessage(input: {
  conversationId: ObjectId;
  participantIds: string[];
  senderId: string;
  senderName: string;
  text: string;
  mediaIds: ObjectId[];
}): Promise<Message> {
  const db = await readyDb();
  const now = new Date();
  const result = await db.collection<MessageDoc>("messages").insertOne({
    conversationId: input.conversationId,
    senderId: input.senderId,
    senderName: input.senderName,
    text: input.text,
    mediaIds: input.mediaIds,
    deletedAt: null,
    createdAt: now,
  });

  const previewText = input.text.length > 0 ? input.text : "Sent a photo";
  await db.collection("conversations").updateOne(
    { _id: input.conversationId },
    {
      $set: {
        lastMessageAt: now,
        lastMessagePreview: {
          text: previewText.slice(0, 80),
          senderId: input.senderId,
          createdAt: now,
        },
      },
    },
  );

  const authorMap = await authorInfoFor([input.senderId]);
  const message = toMessage(
    {
      _id: result.insertedId,
      conversationId: input.conversationId,
      senderId: input.senderId,
      senderName: input.senderName,
      text: input.text,
      mediaIds: input.mediaIds,
      deletedAt: null,
      createdAt: now,
    },
    authorMap.get(input.senderId),
  );

  publishDmEvent(input.participantIds, {
    type: "message_sent",
    conversationId: input.conversationId.toHexString(),
    message,
  });
  return message;
}

export async function softDeleteMessage(input: {
  messageId: ObjectId;
  senderId: string;
  conversationId: ObjectId;
  participantIds: string[];
}): Promise<boolean> {
  const db = await readyDb();
  const result = await db.collection<MessageDoc>("messages").updateOne(
    { _id: input.messageId, senderId: input.senderId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  );
  if (result.modifiedCount !== 1) {
    return false;
  }
  publishDmEvent(input.participantIds, {
    type: "message_deleted",
    conversationId: input.conversationId.toHexString(),
    messageId: input.messageId.toHexString(),
  });
  return true;
}
