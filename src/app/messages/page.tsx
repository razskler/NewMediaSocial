import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Inbox from "@/components/Inbox";
import { createClient } from "@/lib/supabase/server";
import { authorInfoFor, ensureProfileFromMetadata } from "@/lib/profiles";
import { authorNameFromUser } from "@/lib/user";
import { listConversations } from "@/lib/conversations";
import { mutualFollowerIds } from "@/lib/follows";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await ensureProfileFromMetadata(user);

  const { conversations, nextCursor } = await listConversations(user.id, null);

  const mutualIds = await mutualFollowerIds(user.id);
  const infoMap = await authorInfoFor(mutualIds);
  const contacts = mutualIds.map((id) => {
    const info = infoMap.get(id);
    return {
      userId: id,
      username: info?.username ?? null,
      displayName: info?.displayName ?? "Someone",
      avatarMediaId: info?.avatarMediaId ?? null,
    };
  });

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4">
      <Header
        name={profile?.displayName ?? authorNameFromUser(user)}
        isAuthed={!!user}
        username={profile?.username ?? null}
        avatarMediaId={profile?.avatarMediaId ?? null}
      />
      <main className="pb-16">
        <Inbox
          viewerId={user.id}
          initialConversations={conversations}
          initialCursor={nextCursor}
          contacts={contacts}
        />
      </main>
    </div>
  );
}
