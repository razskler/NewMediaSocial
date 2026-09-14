import Link from "next/link";
import type { Post } from "@/lib/posts";
import { relativeTime } from "@/lib/time";
import Avatar from "./Avatar";
import CommentsSection from "./CommentsSection";
import ImageCarousel from "./ImageCarousel";
import LikeButton from "./LikeButton";

function PostText({ text }: { text: string }) {
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  if (parts.length === 1) {
    return (
      <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
        {text}
      </p>
    );
  }
  return (
    <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
      {parts.map((part, index) =>
        part.startsWith("#") && part.length > 1 ? (
          <Link
            key={index}
            href={`/?feed=topics&tag=${part.slice(1).toLowerCase()}`}
            className="text-sky-600 hover:underline"
          >
            {part}
          </Link>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </p>
  );
}

export default function PostCard({
  post,
  canLike,
  canComment,
}: {
  post: Post;
  canLike: boolean;
  canComment: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar
          name={post.authorName}
          mediaId={post.authorAvatarMediaId}
          size="md"
          href={post.authorUsername ? `/u/${post.authorUsername}` : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-1.5">
              {post.authorUsername ? (
                <Link
                  href={`/u/${post.authorUsername}`}
                  className="truncate font-semibold hover:underline"
                >
                  {post.authorName}
                </Link>
              ) : (
                <span className="truncate font-semibold">
                  {post.authorName}
                </span>
              )}
              {post.authorUsername ? (
                <span className="truncate text-xs text-slate-400">
                  @{post.authorUsername}
                </span>
              ) : null}
            </div>
            <time
              dateTime={post.createdAt}
              suppressHydrationWarning
              className="shrink-0 text-xs text-slate-400"
            >
              {relativeTime(post.createdAt)}
            </time>
          </div>

          {post.text.length > 0 ? <PostText text={post.text} /> : null}

          {post.mediaIds.length > 0 ? (
            <div className="mt-2">
              <ImageCarousel mediaIds={post.mediaIds} />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-2">
            <LikeButton
              postId={post.id}
              initialLiked={post.likedByMe}
              initialCount={post.likesCount}
              canLike={canLike}
            />
            <CommentsSection
              postId={post.id}
              canComment={canComment}
              initialCount={post.commentsCount}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
