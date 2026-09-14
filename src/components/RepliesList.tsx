"use client";

import { useState } from "react";
import { fetchUserCommentsAction } from "@/app/actions";
import type { UserComment } from "@/lib/comments";
import { relativeTime } from "@/lib/time";

export default function RepliesList({
  userId,
  initialComments,
  initialCursor,
}: {
  userId: string;
  initialComments: UserComment[];
  initialCursor: string | null;
}) {
  const [comments, setComments] = useState(initialComments);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (loading || !cursor) return;
    setLoading(true);
    try {
      const { comments: next, nextCursor } = await fetchUserCommentsAction(
        userId,
        cursor,
      );
      setComments((prev) => [...prev, ...next]);
      setCursor(nextCursor);
    } catch {
      // Leave the button in place so the user can retry.
    } finally {
      setLoading(false);
    }
  }

  if (comments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
        <p className="font-medium text-slate-700">No replies yet.</p>
        <p className="mt-1 text-sm text-slate-500">
          When they comment on posts, it will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <article
          key={comment.id}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          {comment.post ? (
            <p className="text-xs text-slate-400">
              In reply to{" "}
              <span className="font-medium text-slate-600">
                {comment.post.authorName}
              </span>
              {" — "}
              &ldquo;{comment.post.snippet}
              {comment.post.snippet.length >= 80 ? "…" : ""}&rdquo;
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              In reply to a deleted post
            </p>
          )}
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {comment.text}
          </p>
          <time
            dateTime={comment.createdAt}
            suppressHydrationWarning
            className="mt-1 block text-xs text-slate-400"
          >
            {relativeTime(comment.createdAt)}
          </time>
        </article>
      ))}

      {cursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
