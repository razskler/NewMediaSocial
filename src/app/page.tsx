import Header from "@/components/Header";
import Feed from "@/components/Feed";
import { createClient } from "@/lib/supabase/server";
import { getFeed } from "@/lib/posts";
import { authorNameFromUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { posts, nextCursor } = await getFeed({ viewerId: user?.id ?? null });

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4">
      <Header
        name={user ? authorNameFromUser(user) : null}
        isAuthed={!!user}
      />
      <main className="pb-16">
        <Feed
          initialPosts={posts}
          initialCursor={nextCursor}
          isAuthed={!!user}
        />
      </main>
    </div>
  );
}
