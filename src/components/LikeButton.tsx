"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toggleLikeAction } from "@/app/actions";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export default function LikeButton({
  postId,
  initialLiked,
  initialCount,
  canLike,
}: {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  canLike: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);

  function toggle() {
    if (!canLike) return;
    const optimisticLiked = !liked;
    setLiked(optimisticLiked);
    setCount((c) => c + (optimisticLiked ? 1 : -1));
    startTransition(async () => {
      const result = await toggleLikeAction(postId);
      if (result.ok) {
        setLiked(result.data.liked);
        setCount(result.data.likesCount);
      } else {
        setLiked(!optimisticLiked);
        setCount((c) => c + (optimisticLiked ? -1 : 1));
      }
    });
  }

  if (!canLike) {
    return (
      <Link
        href="/login"
        title="Sign in to like posts"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-rose-500"
      >
        <HeartIcon filled={false} />
        {count > 0 ? <span>{count}</span> : null}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={`inline-flex items-center gap-1.5 text-sm transition ${
        liked ? "text-rose-500" : "text-slate-400 hover:text-rose-500"
      }`}
    >
      <HeartIcon filled={liked} />
      {count > 0 ? <span>{count}</span> : null}
    </button>
  );
}
