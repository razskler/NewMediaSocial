"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFollowAction } from "@/app/actions";

export default function FollowButton({
  userId,
  initialFollowing,
  canFollow,
}: {
  userId: string;
  initialFollowing: boolean;
  canFollow: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const result = await toggleFollowAction(userId);
      if (result.ok) {
        setFollowing(result.data.following);
        // Refresh so the server-rendered follower count updates.
        router.refresh();
      } else {
        setFollowing(!next);
      }
    });
  }

  if (!canFollow) {
    return (
      <Link
        href="/login"
        title="Sign in to follow"
        className="shrink-0 rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        Follow
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      className={
        following
          ? "shrink-0 rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          : "shrink-0 rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
      }
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
