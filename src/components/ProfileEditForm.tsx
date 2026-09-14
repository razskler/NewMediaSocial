"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/app/actions";
import type { Profile } from "@/lib/profiles";
import Avatar from "./Avatar";

const MAX_BIO = 200;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const inputClasses =
  "mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-500";

export default function ProfileEditForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [bio, setBio] = useState(profile.bio);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const shownAvatar = previewUrl ?? (removeAvatar ? null : profile.avatarMediaId);

  function pickFile(list: FileList | null) {
    const picked = list?.[0];
    if (!picked) return;
    if (!ACCEPTED_TYPES.includes(picked.type)) {
      setError("Photos must be JPEG, PNG, WebP, or GIF.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setError("Photos must be 8MB or smaller.");
      return;
    }
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setRemoveAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearAvatarChoice() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      let avatarMediaId: string | null | undefined = undefined;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Avatar upload failed.");
        }
        avatarMediaId = ((await res.json()) as { mediaId: string }).mediaId;
      } else if (removeAvatar) {
        avatarMediaId = null;
      }

      const result = await updateProfileAction({
        bio: bio.trim(),
        avatarMediaId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Profile picture
        </h2>
        <div className="mt-3 flex items-center gap-4">
          <Avatar name={profile.displayName} mediaId={shownAvatar} size="lg" />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={(e) => pickFile(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Change photo
            </button>
            {shownAvatar ? (
              <button
                type="button"
                onClick={clearAvatarChoice}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Identity
        </h2>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="displayNameLocked" className="text-sm font-medium">
              Display name
            </label>
            <input
              id="displayNameLocked"
              value={profile.displayName}
              readOnly
              disabled
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="usernameLocked" className="text-sm font-medium">
              Username
            </label>
            <input
              id="usernameLocked"
              value={`@${profile.username}`}
              readOnly
              disabled
              className={inputClasses}
            />
          </div>
          <p className="text-xs text-slate-400">
            Display name and username are permanent to keep posts and profile
            links stable.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Bio
          </h2>
          <span
            className={`text-xs ${MAX_BIO - bio.length < 20 ? "text-red-500" : "text-slate-400"}`}
          >
            {MAX_BIO - bio.length}
          </span>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
          rows={3}
          placeholder="Tell people about yourself…"
          className="mt-2 w-full resize-y rounded-lg border border-slate-200 p-3 text-[15px] outline-none transition focus:border-slate-400"
        />
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-600">Profile saved.</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
