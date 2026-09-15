import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import ChatWindow from "@/components/ChatWindow";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileFromMetadata } from "@/lib/profiles";
import { authorNameFromUser } from "@/lib/user";
import { getConversationForUser } from "@/lib/conversations";
import { listMessages } from "@/lib/messages";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await ensureProfileFromMetadata(user);

  const conversation = await getConversationForUser(id, user.id);
  if (!conversation) {
    notFound();
  }

  const { messages, nextCursor } = await listMessages(conversation.id, null);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4">
      <Header
        name={profile?.displayName ?? authorNameFromUser(user)}
        isAuthed={!!user}
        username={profile?.username ?? null}
        avatarMediaId={profile?.avatarMediaId ?? null}
      />
      <main className="flex flex-1 flex-col pb-16">
        <ChatWindow
          viewerId={user.id}
          viewerName={profile?.displayName ?? authorNameFromUser(user)}
          viewerUsername={profile?.username ?? null}
          viewerAvatarMediaId={profile?.avatarMediaId ?? null}
          conversation={conversation}
          initialMessages={messages}
          initialCursor={nextCursor}
        />
      </main>
    </div>
  );
}
