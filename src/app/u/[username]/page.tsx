import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import Feed from "@/components/Feed";
import FollowButton from "@/components/FollowButton";
import Header from "@/components/Header";
import RepliesList from "@/components/RepliesList";
import { getCommentsByAuthor } from "@/lib/comments";
import { followCounts, isFollowing } from "@/lib/follows";
import { getFeed } from "@/lib/posts";
import {
  ensureProfileFromMetadata,
  getProfileByUsername,
} from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { authorNameFromUser } from "@/lib/user";

export const dynamic = "force-dynamic";

type ProfileTab = "posts" | "replies" | "likes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(
    decodeURIComponent(username).toLowerCase(),
  );
  return {
    title: profile
      ? `${profile.displayName} (@${profile.username}) — NewMediaSocial`
      : "Profile not found — NewMediaSocial",
  };
}

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(
    decodeURIComponent(username).toLowerCase(),
  );
  if (!profile) {
    notFound();
  }

  const sp = await searchParams;
  const rawTab = typeof sp.tab === "string" ? sp.tab : "posts";
  const tab: ProfileTab =
    rawTab === "replies" || rawTab === "likes" ? rawTab : "posts";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerProfile = user ? await ensureProfileFromMetadata(user) : null;
  const isSelf = !!user && user.id === profile.userId;

  const [counts, following] = await Promise.all([
    followCounts(profile.userId),
    user && !isSelf
      ? isFollowing(user.id, profile.userId)
      : Promise.resolve(false),
  ]);

  const postsPage =
    tab !== "replies"
      ? await getFeed({
          mode: tab === "likes" ? "likes" : "user",
          authorId: profile.userId,
          viewerId: user?.id ?? null,
        })
      : null;
  const repliesPage =
    tab === "replies" ? await getCommentsByAuthor(profile.userId) : null;

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4">
      <Header
        name={
          viewerProfile?.displayName ?? (user ? authorNameFromUser(user) : null)
        }
        isAuthed={!!user}
        username={viewerProfile?.username ?? null}
        avatarMediaId={viewerProfile?.avatarMediaId ?? null}
      />
      <main className="pb-16">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <Avatar
              name={profile.displayName}
              mediaId={profile.avatarMediaId}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold">
                {profile.displayName}
              </h1>
              <p className="text-sm text-slate-500">@{profile.username}</p>
            </div>
            {isSelf ? (
              <Link
                href="/settings/profile"
                className="shrink-0 rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Edit profile
              </Link>
            ) : (
              <FollowButton
                userId={profile.userId}
                initialFollowing={following}
                canFollow={!!user}
              />
            )}
          </div>

          {profile.bio ? (
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
              {profile.bio}
            </p>
          ) : null}

          <p className="mt-3 text-sm text-slate-500">
            <span className="font-medium text-slate-700">
              {counts.followers}
            </span>{" "}
            followers
            <span className="mx-1">·</span>
            <span className="font-medium text-slate-700">
              {counts.following}
            </span>{" "}
            following
            <span className="mx-1">·</span>
            joined{" "}
            {new Date(profile.createdAt).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </section>

        <nav className="mb-4 mt-4 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(
            [
              { key: "posts", label: "Posts" },
              { key: "replies", label: "Replies" },
              { key: "likes", label: "Likes" },
            ] as { key: ProfileTab; label: string }[]
          ).map((item) => (
            <Link
              key={item.key}
              href={`/u/${profile.username}?tab=${item.key}`}
              className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition ${
                tab === item.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {tab === "replies" && repliesPage ? (
          <RepliesList
            userId={profile.userId}
            initialComments={repliesPage.comments}
            initialCursor={repliesPage.nextCursor}
          />
        ) : postsPage ? (
          <Feed
            initialPosts={postsPage.posts}
            initialCursor={postsPage.nextCursor}
            isAuthed={!!user}
            mode={tab === "likes" ? "likes" : "user"}
            authorId={profile.userId}
          />
        ) : null}
      </main>
    </div>
  );
}
