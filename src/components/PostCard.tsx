import type { Post } from "@/lib/posts";
import { relativeTime } from "@/lib/time";
import LikeButton from "./LikeButton";

export default function PostCard({
  post,
  canLike,
}: {
  post: Post;
  canLike: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold">{post.authorName}</span>
        <time
          dateTime={post.createdAt}
          suppressHydrationWarning
          className="shrink-0 text-xs text-slate-400"
        >
          {relativeTime(post.createdAt)}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
        {post.text}
      </p>
      <div className="mt-3 border-t border-slate-100 pt-2">
        <LikeButton
          postId={post.id}
          initialLiked={post.likedByMe}
          initialCount={post.likesCount}
          canLike={canLike}
        />
      </div>
    </article>
  );
}
