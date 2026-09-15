"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import NewMessageDialog from "@/components/NewMessageDialog";
import { listConversationsAction } from "@/app/actions";
import type { Conversation } from "@/lib/conversations";
import { relativeTime } from "@/lib/time";

export type Contact = {
  userId: string;
  username: string | null;
  displayName: string;
  avatarMediaId: string | null;
};

function previewFor(conversation: Conversation, viewerId: string): string {
  const preview = conversation.lastMessagePreview;
  if (!preview) {
    return "No messages yet";
  }
  const prefix = preview.senderId === viewerId ? "You: " : "";
  return `${prefix}${preview.text}`;
}

function rowAvatar(conversation: Conversation, viewerId: string) {
  if (conversation.isGroup) {
    return <Avatar name={conversation.title} size="md" />;
  }
  const other = conversation.participants.find(
    (p) => p.userId !== viewerId,
  );
  return (
    <Avatar
      name={other?.displayName ?? "Direct message"}
      mediaId={other?.avatarMediaId ?? null}
      size="md"
    />
  );
}

export default function Inbox({
  viewerId,
  initialConversations,
  initialCursor,
  contacts,
}: {
  viewerId: string;
  initialConversations: Conversation[];
  initialCursor: string | null;
  contacts: Contact[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [cursor, setCursor] = useState(initialCursor);
  const [done, setDone] = useState(initialCursor === null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { conversations: fresh, nextCursor } =
        await listConversationsAction(null);
      setConversations(fresh);
      setCursor(nextCursor);
      setDone(nextCursor === null);
    } catch {
      // Transient failure: the next event retries the refresh.
    }
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/messages/stream");
    source.addEventListener("dm", () => {
      void refresh();
    });
    return () => source.close();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (loading || done || !cursor) return;
    setLoading(true);
    try {
      const { conversations: next, nextCursor } = await listConversationsAction(
        cursor,
      );
      setConversations((prev) => [...prev, ...next]);
      setCursor(nextCursor);
      if (nextCursor === null) setDone(true);
    } catch {
      // The observer retries on the next intersection.
    } finally {
      setLoading(false);
    }
  }, [cursor, done, loading]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">
          Messages
        </h1>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={contacts.length === 0}
          title={
            contacts.length === 0
              ? "Mutual follows can message each other — follow people who follow you to start chatting."
              : "Start a conversation"
          }
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          New message
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <p className="font-medium text-slate-700">No conversations yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Start a chat with someone who follows you back.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-3 p-4 transition hover:bg-slate-50"
              >
                {rowAvatar(conversation, viewerId)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">
                      {conversation.title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400">
                      {relativeTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {previewFor(conversation, viewerId)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinelRef} aria-hidden />

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
      ) : null}

      {dialogOpen ? (
        <NewMessageDialog
          contacts={contacts}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}
