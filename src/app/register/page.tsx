"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkUsernameAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

const inputClasses =
  "mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none transition focus:border-slate-400";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameHint, setUsernameHint] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    return true;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
      setError("Pick a valid username: 3–20 lowercase letters, numbers, underscores.");
      return;
    }
    if (!(await checkUsername())) {
      setError("That username is already taken — pick another.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            username: normalizedUsername,
          },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        router.replace("/login");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Join NewMediaSocial — posts, photos, topics, and the people you
          follow.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="displayName" className="text-sm font-medium">
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              required
              minLength={1}
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClasses}
            />
            <p className="mt-1 text-xs text-slate-400">
              Permanent — it appears on all your posts.
            </p>
          </div>
          <div>
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <div className="mt-1 flex items-center rounded-lg border border-slate-200 transition focus-within:border-slate-400">
              <span className="pl-2.5 text-sm text-slate-400">@</span>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, "")
                      .slice(0, 20),
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
                Permanent — your profile lives at /u/username.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClasses}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 p-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
