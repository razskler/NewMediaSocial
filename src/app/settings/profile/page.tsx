import { redirect } from "next/navigation";
import Header from "@/components/Header";
import ProfileEditForm from "@/components/ProfileEditForm";
import ProfileSetupForm from "@/components/ProfileSetupForm";
import { getProfileByUserId } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { authorNameFromUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileByUserId(user.id);
  const fallbackName = authorNameFromUser(user);
  const suggestedUsername =
    fallbackName.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) ||
    "user";

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4">
      <Header
        name={profile?.displayName ?? fallbackName}
        isAuthed
        username={profile?.username ?? null}
        avatarMediaId={profile?.avatarMediaId ?? null}
      />
      <main className="pb-16">
        <h1 className="mb-4 text-xl font-bold">Profile settings</h1>
        {profile ? (
          <ProfileEditForm profile={profile} />
        ) : (
          <ProfileSetupForm
            suggestedName={fallbackName}
            suggestedUsername={suggestedUsername}
          />
        )}
      </main>
    </div>
  );
}
