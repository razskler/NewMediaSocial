"use client";

import { useCallback, useRef, useState } from "react";

export default function ImageCarousel({ mediaIds }: { mediaIds: string[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  const scrollTo = useCallback((index: number) => {
    const el = trackRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }, []);

  if (mediaIds.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/media/${mediaIds[0]}`}
        alt="Post photo"
        loading="lazy"
        className="max-h-[420px] w-full rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={() => {
          const el = trackRef.current;
          if (!el || el.clientWidth === 0) {
            return;
          }
          const index = Math.round(el.scrollLeft / el.clientWidth);
          setActive(
            Math.min(mediaIds.length - 1, Math.max(0, index)),
          );
        }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {mediaIds.map((mediaId, index) => (
          <div key={mediaId} className="w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media/${mediaId}`}
              alt={`Post photo ${index + 1} of ${mediaIds.length}`}
              loading="lazy"
              className="max-h-[420px] w-full object-cover"
            />
          </div>
        ))}
      </div>

      {active > 0 ? (
        <button
          type="button"
          onClick={() => scrollTo(active - 1)}
          aria-label="Previous photo"
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/60 text-lg font-bold text-white transition hover:bg-slate-900/80"
        >
          ‹
        </button>
      ) : null}
      {active < mediaIds.length - 1 ? (
        <button
          type="button"
          onClick={() => scrollTo(active + 1)}
          aria-label="Next photo"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/60 text-lg font-bold text-white transition hover:bg-slate-900/80"
        >
          ›
        </button>
      ) : null}

      <div className="mt-2 flex justify-center gap-1.5">
        {mediaIds.map((mediaId, index) => (
          <button
            key={mediaId}
            type="button"
            onClick={() => scrollTo(index)}
            aria-label={`Go to photo ${index + 1}`}
            className={`h-2 w-2 rounded-full transition ${
              index === active ? "bg-slate-700" : "bg-slate-300 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
