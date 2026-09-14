"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchFeedAction } from "@/app/actions";
import type { FeedMode, Post } from "@/lib/posts";
import ComposeBox from "./ComposeBox";
import PostCard from "./PostCard";

function emptyTitle(mode: FeedMode): string {
  switch (mode) {
    case "following":
      return "Your Following feed is empty.";
    case "topic":
      return "No posts with this topic yet.";
    case "user":
      return "No posts yet.";
    case "likes":
      return "No liked posts yet.";
    default:
      return "Nothing here yet.";
  }
}

function emptyBody(
  mode: FeedMode,
  tag: string | null,
  isAuthed: boolean,
): string {
  switch (mode) {
    case "following":
      return isAuthed
        ? "Follow people from the Suggested tab and their posts will show up here."
        : "Log in to follow people and see their posts here.";
    case "topic":
      return tag
        ? `Be the first to post about #${tag}.`
        : "Be the first to post about this topic.";
    case "user":
      return "When they post, it will show up here.";
    case "likes":
      return "Posts they like will show up here.";
    default:
      return isAuthed
        ? "Be the first to post something."
        : "Log in to be the first to post something.";
  }
}

function doneMessage(mode: FeedMode): string {
  switch (mode) {
    case "following":
      return "You're all caught up with the people you follow.";
    case "suggested":
      return "That's all our suggestions for now — check back later.";
    default:
      return "You're all caught up.";
  }
}

export default function Feed({
  initialPosts,
  initialCursor,
  isAuthed,
  mode,
  tag = null,
  authorId = null,
  compose = false,
}: {
  initialPosts: Post[];
  initialCursor: string | null;
  isAuthed: boolean;
  mode: FeedMode;
  tag?: string | null;
  authorId?: string | null;
  compose?: boolean;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [done, setDone] = useState(initialCursor === null);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || done || !cursor) return;
    setLoading(true);
    try {
      const { posts: nextPosts, nextCursor } = await fetchFeedAction({
        cursor,
        mode,
        tag,
        authorId,
      });
      setPosts((prev) => [...prev, ...nextPosts]);
      setCursor(nextCursor);
      if (nextCursor === null) setDone(true);
    } catch {
      // Transient failure: the observer retries on the next intersection.
    } finally {
      setLoading(false);
    }
  }, [cursor, done, loading, mode, tag, authorId]);

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

  function handleCreated(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  return (
    <div className="space-y-4">
      {compose && isAuthed ? <ComposeBox onCreated={handleCreated} /> : null}

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <p className="font-medium text-slate-700">{emptyTitle(mode)}</p>
          <p className="mt-1 text-sm text-slate-500">
            {emptyBody(mode, tag, isAuthed)}
          </p>
          {!isAuthed ? (
            <p className="mt-2 text-sm text-slate-500">
              <Link href="/login" className="underline">
                Log in
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            canLike={isAuthed}
            canComment={isAuthed}
          />
        ))
      )}

      <div ref={sentinelRef} aria-hidden />

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
      ) : null}

      {done && posts.length > 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          {doneMessage(mode)}
        </p>
      ) : null}
    </div>
  );
}
