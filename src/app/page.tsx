import Link from "next/link";
import Header from "@/components/Header";
import Feed from "@/components/Feed";
import FeedTabs, { type FeedTab } from "@/components/FeedTabs";
import { createClient } from "@/lib/supabase/server";
import { getFeed, getTrendingHashtags, type FeedMode } from "@/lib/posts";
import { ensureProfileFromMetadata } from "@/lib/profiles";
import { authorNameFromUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await ensureProfileFromMetadata(user) : null;

  const rawFeed = typeof params.feed === "string" ? params.feed : "suggested";
  let tab: FeedTab =
    rawFeed === "following" || rawFeed === "topics" ? rawFeed : "suggested";
  if (!user && tab === "following") {
    tab = "suggested";
  }

  const rawTag = typeof params.tag === "string" ? params.tag : null;
  const tag =
    rawTag && /^[a-zA-Z0-9_]{1,30}$/.test(rawTag)
      ? rawTag.toLowerCase()
      : null;

  const mode: FeedMode =
    tab === "following"
      ? "following"
      : tab === "topics" && tag
        ? "topic"
        : "suggested";

  const { posts, nextCursor } = await getFeed({
    viewerId: user?.id ?? null,
    mode,
    tag,
  });
  const trending = tab === "topics" ? await getTrendingHashtags() : [];

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4">
      <Header
        name={profile?.displayName ?? (user ? authorNameFromUser(user) : null)}
        isAuthed={!!user}
        username={profile?.username ?? null}
        avatarMediaId={profile?.avatarMediaId ?? null}
      />
      <main className="pb-16">
        {user && !profile ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              Finish setting up your profile — pick your display name and
              @username.
            </p>
            <Link
              href="/settings/profile"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700"
            >
              Set up
            </Link>
          </div>
        ) : null}

        <FeedTabs
          active={tab}
          isAuthed={!!user}
          trending={trending}
          activeTag={tag}
        />

        {tab === "topics" && !tag ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
            Pick a topic above to see posts about it — or write a post with a
            #hashtag to start one.
          </p>
        ) : (
          <Feed
            initialPosts={posts}
            initialCursor={nextCursor}
            isAuthed={!!user}
            mode={mode}
            tag={tag}
            compose
          />
        )}
      </main>
    </div>
  );
}
