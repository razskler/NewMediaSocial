"use client";

import { useRef, useState, useTransition } from "react";
import { createPostAction } from "@/app/actions";
import type { Post } from "@/lib/posts";

const MAX_LENGTH = 500;
const MAX_PHOTOS = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Photo = { file: File; url: string };

function PhotoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

async function uploadPhotos(photos: Photo[]): Promise<string[]> {
  const mediaIds: string[] = [];
  for (const photo of photos) {
    const formData = new FormData();
    formData.append("file", photo.file);
    const res = await fetch("/api/media", { method: "POST", body: formData });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? "Photo upload failed.");
    }
    const data = (await res.json()) as { mediaId: string };
    mediaIds.push(data.mediaId);
  }
  return mediaIds;
}

export default function ComposeBox({
  onCreated,
}: {
  onCreated: (post: Post) => void;
}) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function addPhotos(list: FileList | null) {
    if (!list || list.length === 0) {
      return;
    }
    setError(null);
    setPhotos((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (next.length >= MAX_PHOTOS) {
          setError(`You can attach up to ${MAX_PHOTOS} photos.`);
          break;
        }
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setError("Photos must be JPEG, PNG, WebP, or GIF.");
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setError("Each photo must be 8MB or smaller.");
          continue;
        }
        next.push({ file, url: URL.createObjectURL(file) });
      }
      return next;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    const currentText = text;
    const currentPhotos = photos;
    startTransition(async () => {
      try {
        const mediaIds =
          currentPhotos.length > 0 ? await uploadPhotos(currentPhotos) : [];
        const result = await createPostAction(currentText, mediaIds);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        for (const photo of currentPhotos) {
          URL.revokeObjectURL(photo.url);
        }
        setText("");
        setPhotos([]);
        onCreated(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const remaining = MAX_LENGTH - text.length;
  const canSubmit =
    (text.trim().length > 0 || photos.length > 0) && !pending;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
        placeholder="What's happening? Use #hashtags to tag topics."
        rows={3}
        className="w-full resize-y rounded-lg border border-slate-200 p-3 text-[15px] outline-none transition focus:border-slate-400"
        disabled={pending}
      />

      {photos.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <div key={photo.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Photo ${index + 1} preview`}
                className="h-20 w-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white transition hover:bg-slate-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            onChange={(e) => addPhotos(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || photos.length >= MAX_PHOTOS}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PhotoIcon />
            <span>
              {photos.length}/{MAX_PHOTOS}
            </span>
          </button>
          <span
            className={`text-xs ${remaining < 50 ? "text-red-500" : "text-slate-400"}`}
          >
            {remaining}
          </span>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
