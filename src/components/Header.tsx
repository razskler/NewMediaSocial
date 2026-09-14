import Link from "next/link";
import Avatar from "@/components/Avatar";
import { logoutAction } from "@/app/actions";

export default function Header({
  name,
  isAuthed,
  username = null,
  avatarMediaId = null,
}: {
  name: string | null;
  isAuthed: boolean;
  username?: string | null;
  avatarMediaId?: string | null;
}) {
  return (
    <header className="sticky top-0 z-10 -mx-4 mb-6 border-b border-slate-200 bg-slate-100/90 px-4 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          NewMediaSocial
        </Link>
        {isAuthed ? (
          <div className="flex items-center gap-3">
            {name ? (
              <Avatar
                name={name}
                mediaId={avatarMediaId}
                size="sm"
                href={username ? `/u/${username}` : "/settings/profile"}
              />
            ) : null}
            {username ? (
              <Link
                href={`/u/${username}`}
                className="hidden max-w-40 truncate text-sm font-medium text-slate-700 hover:underline sm:block"
              >
                {name}
              </Link>
            ) : (
              <span className="hidden max-w-40 truncate text-sm text-slate-600 sm:block">
                {name}
              </span>
            )}
            <Link
              href="/settings/profile"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
            >
              Settings
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
              >
                Log out
              </button>
            </form>
          </div>
        ) : (
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-200"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-white transition hover:bg-slate-700"
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
