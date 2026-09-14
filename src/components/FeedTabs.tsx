import Link from "next/link";
import type { TrendingTag } from "@/lib/posts";

export type FeedTab = "suggested" | "following" | "topics";

export default function FeedTabs({
  active,
  isAuthed,
  trending,
  activeTag,
}: {
  active: FeedTab;
  isAuthed: boolean;
  trending: TrendingTag[];
  activeTag: string | null;
}) {
  const tabs: { key: FeedTab; label: string; href: string }[] = [
    { key: "suggested", label: "Suggested", href: "/?feed=suggested" },
    ...(isAuthed
      ? [{ key: "following" as FeedTab, label: "Following", href: "/?feed=following" }]
      : []),
    { key: "topics", label: "Topics", href: "/?feed=topics" },
  ];

  return (
    <div className="mb-4 space-y-3">
      <nav className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition ${
              active === tab.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {active === "topics" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Trending this week
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {trending.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hashtags yet — add #tags to your posts and they&apos;ll show
                up here.
              </p>
            ) : (
              trending.map(({ tag, count }) => (
                <Link
                  key={tag}
                  href={`/?feed=topics&tag=${tag}`}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    activeTag === tag
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  #{tag}
                  <span className="ml-1 text-xs opacity-70">{count}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
