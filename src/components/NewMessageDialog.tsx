"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { startConversationAction } from "@/app/actions";
import type { Contact } from "@/components/Inbox";

export default function NewMessageDialog({
  contacts,
  onClose,
}: {
  contacts: Contact[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? contacts.filter(
        (c) =>
          c.displayName.toLowerCase().includes(normalizedQuery) ||
          (c.username ?? "").toLowerCase().includes(normalizedQuery),
      )
    : contacts;

  function toggle(userId: string) {
    setError(null);
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  function start() {
    if (pending || selected.length === 0) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await startConversationAction({
        participantUserIds: selected,
        title: selected.length > 1 && title.trim().length > 0 ? title : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.push(`/messages/${result.data.conversation.id}`);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Start a conversation"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900">New message</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            You can message people who follow you back.
          </p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="mt-3 w-full rounded-lg border border-slate-200 p-2 text-sm outline-none transition focus:border-slate-400"
          />
        </div>

        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="p-4 text-sm text-slate-500">
              No matches. Follow people who follow you to unlock DMs.
            </li>
          ) : (
            filtered.map((contact) => {
              const isSelected = selected.includes(contact.userId);
              return (
                <li key={contact.userId}>
                  <button
                    type="button"
                    onClick={() => toggle(contact.userId)}
                    className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-slate-50"
                  >
                    <Avatar
                      name={contact.displayName}
                      mediaId={contact.avatarMediaId}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {contact.displayName}
                      </span>
                      {contact.username ? (
                        <span className="block truncate text-xs text-slate-500">
                          @{contact.username}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold text-white ${
                        isSelected
                          ? "border-slate-900 bg-slate-900"
                          : "border-slate-300"
                      }`}
                      aria-hidden
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {selected.length > 1 ? (
          <div className="border-t border-slate-200 p-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="Group name (optional)"
              className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
        ) : null}

        {error ? (
          <p className="px-4 pt-2 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
          <span className="text-xs text-slate-500">
            {selected.length === 0
              ? "Select at least one person"
              : selected.length === 1
                ? "Direct message"
                : `Group chat · ${selected.length + 1} people`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={start}
              disabled={pending || selected.length === 0}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Starting…" : "Start chat"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
