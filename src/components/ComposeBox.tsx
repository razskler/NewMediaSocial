"use client";

import { useState, useTransition } from "react";
import { createPostAction } from "@/app/actions";
import type { Post } from "@/lib/posts";

const MAX_LENGTH = 500;

export default function ComposeBox({
  onCreated,
}: {
  onCreated: (post: Post) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    const current = text;
    startTransition(async () => {
      const result = await createPostAction(current);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setText("");
      onCreated(result.data);
    });
  }

  const remaining = MAX_LENGTH - text.length;
  const canSubmit = text.trim().length > 0 && !pending;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
        placeholder="What's happening?"
        rows={3}
        className="w-full resize-y rounded-lg border border-slate-200 p-3 text-[15px] outline-none transition focus:border-slate-400"
        disabled={pending}
      />
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-xs ${remaining < 50 ? "text-red-500" : "text-slate-400"}`}
        >
          {remaining}
        </span>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
