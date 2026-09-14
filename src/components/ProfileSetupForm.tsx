"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkUsernameAction, setUpProfileAction } from "@/app/actions";

export default function ProfileSetupForm({
  suggestedName,
  suggestedUsername,
}: {
  suggestedName: string;
  suggestedUsername: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(suggestedName);
  const [username, setUsername] = useState(suggestedUsername);
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function checkUsername(): Promise<boolean> {
    const value = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(value)) {
      setUsernameHint(
        value
          ? "3–20 characters: lowercase letters, numbers, underscores."
          : null,
      );
      return false;
    }
    setUsernameHint("Checking…");
    const result = await checkUsernameAction(value);
    if (result.ok) {
      setUsernameHint(
        result.data.available ? "Available." : "Already taken.",
      );
      return result.data.available;
    }
    setUsernameHint(null);
    // Server hiccup: let the submit action be the final arbiter.
    return true;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const value = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(value)) {
        setError("Pick a valid username first.");
        return;
      }
      if (!(await checkUsername())) {
        setError("That username is taken — pick another.");
        return;
      }
      const result = await setUpProfileAction({
        username: value,
        displayName: displayName.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUsernameHint(null);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-amber-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-bold">Finish setting up your profile</h2>
        <p className="mt-1 text-sm text-amber-700">
          Choose carefully — your display name and username are permanent to
          keep posts and profile links stable.
        </p>
      </div>

      <div>
        <label htmlFor="setupDisplayName" className="text-sm font-medium">
          Display name
        </label>
        <input
          id="setupDisplayName"
          type="text"
          required
          minLength={1}
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none transition focus:border-slate-400"
        />
      </div>

      <div>
        <label htmlFor="setupUsername" className="text-sm font-medium">
          Username
        </label>
        <div className="mt-1 flex items-center rounded-lg border border-slate-200 transition focus-within:border-slate-400">
          <span className="pl-2.5 text-sm text-slate-400">@</span>
          <input
            id="setupUsername"
            type="text"
            required
            value={username}
            onChange={(e) => {
              setUsername(
                e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20),
              );
              setUsernameHint(null);
            }}
            onBlur={() => void checkUsername()}
            className="w-full rounded-r-lg bg-transparent p-2.5 text-sm outline-none"
          />
        </div>
        {usernameHint ? (
          <p
            className={`mt-1 text-xs ${
              usernameHint === "Available."
                ? "text-emerald-600"
                : usernameHint === "Already taken."
                  ? "text-red-600"
                  : "text-slate-400"
            }`}
          >
            {usernameHint}
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            3–20 characters: lowercase letters, numbers, underscores.
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Saving…" : "Create my profile"}
      </button>
    </form>
  );
}
