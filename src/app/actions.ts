"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createPost, getFeed, toggleLike, type Post } from "@/lib/posts";
import { authorNameFromUser } from "@/lib/user";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const postSchema = z
  .string()
  .trim()
  .min(1, "Your post needs at least one character.")
  .max(500, "Posts are limited to 500 characters.");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a display name.")
  .max(50, "Display names are limited to 50 characters.");

export async function createPostAction(
  text: string,
): Promise<ActionResult<Post>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to post." };
  }

  const parsed = postSchema.safeParse(text);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const nameParsed = nameSchema.safeParse(authorNameFromUser(user));
  const post = await createPost({
    authorId: user.id,
    authorName: nameParsed.success ? nameParsed.data : "Anonymous",
    text: parsed.data,
  });

  return { ok: true, data: post };
}

export async function toggleLikeAction(
  postId: string,
): Promise<ActionResult<{ liked: boolean; likesCount: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to like posts." };
  }

  try {
    return { ok: true, data: await toggleLike(postId, user.id) };
  } catch {
    return { ok: false, error: "Could not update that like." };
  }
}

export async function fetchFeedAction(
  cursor: string | null,
): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return getFeed({ viewerId: user?.id ?? null, cursor });
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
