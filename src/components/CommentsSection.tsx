"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addCommentAction, listCommentsAction } from "@/app/actions";
import type { Comment, CommentThread } from "@/lib/comments";
import { relativeTime } from "@/lib/time";
import Avatar from "./Avatar";

function BubbleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CommentRow({
  comment,
  onReply,
  canComment,
}: {
  comment: Comment;
  onReply: (comment: Comment) => void;
  canComment: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Avatar
        name={comment.authorName}
        mediaId={comment.authorAvatarMediaId}
        size="sm"
        href={
          comment.authorUsername ? `/u/${comment.authorUsername}` : undefined
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {comment.authorUsername ? (
            <Link
              href={`/u/${comment.authorUsername}`}
              className="text-sm font-semibold hover:underline"
            >
              {comment.authorName}
            </Link>
          ) : (
            <span className="text-sm font-semibold">{comment.authorName}</span>
          )}
          <time
            dateTime={comment.createdAt}
            suppressHydrationWarning
            className="text-xs text-slate-400"
          >
            {relativeTime(comment.createdAt)}
          </time>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">
          {comment.text}
        </p>
        {canComment ? (
          <button
            type="button"
            onClick={() => onReply(comment)}
            className="mt-0.5 text-xs font-medium text-slate-400 transition hover:text-slate-600"
          >
            Reply
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function CommentsSection({
  postId,
  canComment,
  initialCount,
}: {
  postId: string;
  canComment: boolean;
  initialCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<CommentThread[] | null>(null);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [text, setText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && threads === null) {
      setLoading(true);
      setLoadError(null);
      const result = await listCommentsAction(postId);
      if (result.ok) {
        setThreads(result.data.threads);
      } else {
        setLoadError(result.error);
      }
      setLoading(false);
    }
  }

  function submitComment(parentId: string | null, value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addCommentAction({
        postId,
        parentId,
        text: trimmed,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const comment = result.data;
      setCount((c) => c + 1);
      if (parentId === null) {
        setThreads((prev) =>
          prev ? [{ ...comment, replies: [] }, ...prev] : prev,
        );
        setText("");
      } else {
        setThreads((prev) =>
          prev
            ? prev.map((thread) =>
                thread.id === parentId
                  ? { ...thread, replies: [...thread.replies, comment] }
                  : thread,
              )
            : prev,
        );
        setReplyText("");
        setReplyTo(null);
      }
    });
  }

  const toggle = (
    <button
      type="button"
      onClick={toggleOpen}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-sky-600"
    >
      <BubbleIcon />
      {count > 0 ? <span>{count}</span> : null}
    </button>
  );

  return (
    <>
      {toggle}
      {open ? (
        <div className="basis-full space-y-4 pt-1">
          {loading ? (
            <p className="text-sm text-slate-400">Loading comments…</p>
          ) : null}
          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : null}
          {threads !== null && threads.length === 0 && !loading ? (
            <p className="text-sm text-slate-400">No comments yet.</p>
          ) : null}

          {threads?.map((thread) => (
            <div key={thread.id} className="space-y-3">
              <CommentRow
                comment={thread}
                canComment={canComment}
                onReply={(c) => {
                  setReplyTo(c);
                  setReplyText("");
                }}
              />
              {thread.replies.length > 0 ? (
                <div className="ml-10 space-y-3 border-l-2 border-slate-100 pl-3">
                  {thread.replies.map((reply) => (
                    <CommentRow
                      key={reply.id}
                      comment={reply}
                      canComment={canComment}
                      onReply={() => {
                        setReplyTo(thread);
                        setReplyText("");
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {canComment && replyTo?.id === thread.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitComment(thread.id, replyText);
                  }}
                  className="ml-10 flex gap-2"
                >
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
                    placeholder={`Reply to ${thread.authorName}…`}
                    className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none transition focus:border-slate-400"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
                  >
                    Reply
                  </button>
                </form>
              ) : null}
            </div>
          ))}

          {canComment ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitComment(null, text);
              }}
              className="flex gap-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                placeholder="Write a comment…"
                className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none transition focus:border-slate-400"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
              >
                Comment
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-400">
              <Link href="/login" className="underline">
                Log in
              </Link>{" "}
              to join the conversation.
            </p>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </>
  );
}
