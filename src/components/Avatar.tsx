import Link from "next/link";

const COLORS = [
  "bg-rose-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-teal-500",
];

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-2xl",
} as const;

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

export default function Avatar({
  name,
  mediaId = null,
  size = "md",
  href,
}: {
  name: string;
  mediaId?: string | null;
  size?: keyof typeof SIZES;
  href?: string;
}) {
  const label = name.trim().slice(0, 1).toUpperCase() || "?";
  const inner = mediaId ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/media/${mediaId}`}
      alt={`${name}'s avatar`}
      className={`${SIZES[size]} rounded-full object-cover`}
    />
  ) : (
    <span
      aria-hidden
      className={`${SIZES[size]} ${colorFor(name)} flex items-center justify-center rounded-full font-bold text-white`}
    >
      {label}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label={`${name}'s profile`} className="shrink-0">
        {inner}
      </Link>
    );
  }
  return <div className="shrink-0">{inner}</div>;
}
