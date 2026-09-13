"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchFeedAction } from "@/app/actions";
import type { Post } from "@/lib/posts";
import ComposeBox from "./ComposeBox";
import PostCard from "./PostCard";

export default function Feed({
  initialPosts,
  initialCursor,
  isAuthed,
}: {
  initialPosts: Post[];
  initialCursor: string | null;
  isAuthed: boolean;
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
      const { posts: nextPosts, nextCursor } = await fetchFeedAction(cursor);
      setPosts((prev) => [...prev, ...nextPosts]);
      setCursor(nextCursor);
      if (nextCursor === null) setDone(true);
    } catch {
      // Transient failure: the observer retries on the next intersection.
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

  function handleCreated(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  return (
    <div className="space-y-4">
      {isAuthed ? <ComposeBox onCreated={handleCreated} /> : null}

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
          <p className="font-medium text-slate-700">Nothing here yet.</p>
          {isAuthed ? (
            <p className="mt-1 text-sm text-slate-500">
              Be the first to post something.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              <Link href="/login" className="underline">
                Log in
              </Link>{" "}
              to be the first to post something.
            </p>
          )}
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} canLike={isAuthed} />
        ))
      )}

      <div ref={sentinelRef} aria-hidden />

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
      ) : null}

      {done && posts.length > 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">
          That&apos;s everything everyone posted — you&apos;re all caught up.
        </p>
      ) : null}
    </div>
  );
}
