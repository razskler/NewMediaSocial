"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import {
  deleteMessageAction,
  listMessagesAction,
  sendMessageAction,
} from "@/app/actions";
import type { Conversation } from "@/lib/conversations";
import type { Message } from "@/lib/messages";
import { relativeTime } from "@/lib/time";

const MAX_LENGTH = 500;
const MAX_PHOTOS = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Photo = { file: File; url: string };

type DmEventPayload =
  | { type: "message_sent"; conversationId: string; message: Message }
  | { type: "message_deleted"; conversationId: string; messageId: string };

async function uploadPhotos(photos: Photo[]): Promise<string[]> {
  const mediaIds: string[] = [];
  for (const photo of photos) {
    const formData = new FormData();
    formData.append("file", photo.file);
    const res = await fetch("/api/media", { method: "POST", body: formData });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? "Photo upload failed.");
    }
    const data = (await res.json()) as { mediaId: string };
    mediaIds.push(data.mediaId);
  }
  return mediaIds;
}

function MessagePhotos({ mediaIds }: { mediaIds: string[] }) {
  if (mediaIds.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/media/${mediaIds[0]}`}
        alt="Shared photo"
        loading="lazy"
        className="max-h-72 w-full rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="grid grid-cols-2 gap-1">
      {mediaIds.map((mediaId, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={mediaId}
          src={`/api/media/${mediaId}`}
          alt={`Shared photo ${index + 1} of ${mediaIds.length}`}
          loading="lazy"
          className="h-36 w-full rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

export default function ChatWindow({
  viewerId,
  viewerName,
  viewerUsername,
  viewerAvatarMediaId,
  conversation,
  initialMessages,
  initialCursor,
}: {
  viewerId: string;
  viewerName: string;
  viewerUsername: string | null;
  viewerAvatarMediaId: string | null;
  conversation: Conversation;
  initialMessages: Message[];
  initialCursor: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>(() =>
    [...initialMessages].reverse(),
  );
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const skipScrollRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  }, []);

  useEffect(() => {
    scrollToBottom("auto");
  }, [scrollToBottom]);

  useEffect(() => {
    const source = new EventSource("/api/messages/stream");
    source.addEventListener("dm", (e) => {
      let event: DmEventPayload;
      try {
        event = JSON.parse((e as MessageEvent).data) as DmEventPayload;
      } catch {
        return;
      }
      if (event.conversationId !== conversation.id) {
        return;
      }
      if (event.type === "message_sent") {
        const incoming = event.message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) {
            return prev;
          }
          const withoutTemp = prev.filter(
            (m) =>
              !(
                m.id.startsWith("temp-") &&
                m.senderId === incoming.senderId &&
                m.text === incoming.text
              ),
          );
          return [...withoutTemp, incoming];
        });
      } else if (event.type === "message_deleted") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId
              ? { ...m, deleted: true, text: null, mediaIds: [] }
              : m,
          ),
        );
      }
    });
    return () => source.close();
  }, [conversation.id]);

  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    if (nearBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages, scrollToBottom]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  async function loadOlder() {
    if (loadingOlder || cursor === null) {
      return;
    }
    setLoadingOlder(true);
    try {
      const { messages: olderPage, nextCursor } = await listMessagesAction(
        conversation.id,
        cursor,
      );
      skipScrollRef.current = true;
      setMessages((prev) => [...[...olderPage].reverse(), ...prev]);
      setCursor(nextCursor);
      const el = scrollRef.current;
      const prevHeight = el?.scrollHeight ?? 0;
      requestAnimationFrame(() => {
        const el2 = scrollRef.current;
        if (el2) {
          el2.scrollTop += el2.scrollHeight - prevHeight;
        }
      });
    } catch {
      // Retrying is a button click away.
    } finally {
      setLoadingOlder(false);
    }
  }

  function addPhotos(list: FileList | null) {
    if (!list || list.length === 0) {
      return;
    }
    setError(null);
    setPhotos((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (next.length >= MAX_PHOTOS) {
          setError(`You can attach up to ${MAX_PHOTOS} photos.`);
          break;
        }
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setError("Photos must be JPEG, PNG, WebP, or GIF.");
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setError("Each photo must be 8MB or smaller.");
          continue;
        }
        next.push({ file, url: URL.createObjectURL(file) });
      }
      return next;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function send() {
    if (pending) {
      return;
    }
    const currentText = text.trim();
    if (currentText.length === 0 && photos.length === 0) {
      return;
    }
    setError(null);
    const currentPhotos = photos;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversationId: conversation.id,
      senderId: viewerId,
      senderName: viewerName,
      senderUsername: viewerUsername,
      senderAvatarMediaId: viewerAvatarMediaId,
      text: currentText,
      mediaIds: [],
      deleted: false,
      createdAt: new Date().toISOString(),
    };
    nearBottomRef.current = true;
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setPhotos([]);
    startTransition(async () => {
      try {
        const mediaIds =
          currentPhotos.length > 0 ? await uploadPhotos(currentPhotos) : [];
        const result = await sendMessageAction({
          conversationId: conversation.id,
          text: currentText,
          mediaIds,
        });
        if (!result.ok) {
          setError(result.error);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setText(currentText);
          return;
        }
        for (const photo of currentPhotos) {
          URL.revokeObjectURL(photo.url);
        }
        const real = result.data.message;
        setMessages((prev) =>
          prev.some((m) => m.id === real.id)
            ? prev.filter((m) => m.id !== tempId)
            : prev.map((m) => (m.id === tempId ? real : m)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function deleteOwn(message: Message) {
    const snapshot = message;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? { ...m, deleted: true, text: null, mediaIds: [] }
          : m,
      ),
    );
    startTransition(async () => {
      const result = await deleteMessageAction(message.id);
      if (!result.ok) {
        setError(result.error);
        setMessages((prev) =>
          prev.map((m) => (m.id === snapshot.id ? snapshot : m)),
        );
      }
    });
  }

  const other = conversation.participants.filter(
    (p) => p.userId !== viewerId,
  );
  const headerHref =
    !conversation.isGroup && other.length === 1 && other[0].username
      ? `/u/${other[0].username}`
      : null;

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-96 flex-col">
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="rounded-lg px-2 py-1 text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          ‹
        </Link>
        {conversation.isGroup ? (
          <Avatar name={conversation.title} size="sm" />
        ) : other.length === 1 ? (
          <Avatar
            name={other[0].displayName}
            mediaId={other[0].avatarMediaId}
            size="sm"
            href={headerHref ?? undefined}
          />
        ) : null}
        <div className="min-w-0">
          {headerHref ? (
            <Link
              href={headerHref}
              className="block truncate font-semibold text-slate-900 hover:underline"
            >
              {conversation.title}
            </Link>
          ) : (
            <p className="truncate font-semibold text-slate-900">
              {conversation.title}
            </p>
          )}
          <p className="text-xs text-slate-500">
            {conversation.isGroup
              ? `${conversation.participants.length} people`
              : other.length === 1 && other[0].username
                ? `@${other[0].username}`
                : ""}
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {cursor !== null ? (
          <div className="pb-2 text-center">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No messages yet — say hello!
          </p>
        ) : null}

        {messages.map((message) => {
          const own = message.senderId === viewerId;
          if (message.deleted) {
            return (
              <div
                key={message.id}
                className="flex justify-center"
                title={relativeTime(message.createdAt)}
              >
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs italic text-slate-400">
                  Message deleted
                </span>
              </div>
            );
          }
          return (
            <div
              key={message.id}
              className={`group flex items-end gap-2 ${
                own ? "flex-row-reverse" : ""
              }`}
            >
              {!own ? (
                <Avatar
                  name={message.senderName}
                  mediaId={message.senderAvatarMediaId}
                  size="sm"
                />
              ) : null}
              <div
                className={`max-w-[75%] ${
                  own ? "text-right" : "text-left"
                }`}
                title={relativeTime(message.createdAt)}
              >
                {!own && conversation.isGroup ? (
                  <p className="mb-0.5 px-1 text-xs font-medium text-slate-500">
                    {message.senderName}
                  </p>
                ) : null}
                <div
                  className={`space-y-1 rounded-2xl px-3 py-2 text-[15px] ${
                    own
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  {message.text && message.text.length > 0 ? (
                    <p className="whitespace-pre-wrap break-words">
                      {message.text}
                    </p>
                  ) : message.mediaIds.length > 0 ? (
                    <MessagePhotos mediaIds={message.mediaIds} />
                  ) : (
                    <p className="italic opacity-70">Sending…</p>
                  )}
                </div>
                {own ? (
                  <button
                    type="button"
                    onClick={() => deleteOwn(message)}
                    className="invisible px-1 text-xs text-slate-400 transition hover:text-red-500 group-hover:visible focus:visible"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        {photos.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {photos.map((photo, index) => (
              <div key={photo.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={`Photo ${index + 1} preview`}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white transition hover:bg-slate-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mb-2 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            onChange={(e) => addPhotos(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || photos.length >= MAX_PHOTOS}
            aria-label="Attach photos"
            className="shrink-0 rounded-lg px-2 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Photo {photos.length}/{MAX_PHOTOS}
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={onKeyDown}
            placeholder="Write a message…"
            rows={1}
            className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-slate-200 p-2 text-[15px] outline-none transition focus:border-slate-400"
          />
          <button
            type="submit"
            disabled={
              pending || (text.trim().length === 0 && photos.length === 0)
            }
            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
