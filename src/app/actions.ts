"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { createClient } from "@/lib/supabase/server";
import {
  createPost,
  extractHashtags,
  getFeed,
  MAX_MEDIA_PER_POST,
  toggleLike,
  type FeedMode,
  type Post,
} from "@/lib/posts";
import {
  addComment,
  getCommentsByAuthor,
  listComments,
  type CommentThread,
  type UserComment,
} from "@/lib/comments";
import { toggleFollow } from "@/lib/follows";
import { mediaExists } from "@/lib/media";
import {
  createProfile,
  getProfileByUserId,
  updateProfile,
  usernameAvailable,
  UsernameTakenError,
  type Profile,
} from "@/lib/profiles";
import { authorNameFromUser } from "@/lib/user";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const postTextSchema = z
  .string()
  .trim()
  .max(500, "Posts are limited to 500 characters.");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Please enter a display name.")
  .max(50, "Display names are limited to 50 characters.");

const usernameSchema = z
  .string()
  .regex(
    /^[a-z0-9_]{3,20}$/,
    "Usernames are 3–20 characters: lowercase letters, numbers, and underscores.",
  );

const mediaIdsSchema = z
  .array(z.string().regex(/^[0-9a-f]{24}$/, "Invalid photo reference."))
  .max(MAX_MEDIA_PER_POST, `Posts are limited to ${MAX_MEDIA_PER_POST} photos.`);

const commentTextSchema = z
  .string()
  .trim()
  .min(1, "Comments need at least one character.")
  .max(500, "Comments are limited to 500 characters.");

const bioSchema = z
  .string()
  .trim()
  .max(200, "Bios are limited to 200 characters.");

const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/, "Invalid id.");

const FEED_MODES: FeedMode[] = [
  "suggested",
  "following",
  "topic",
  "user",
  "likes",
];

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function createPostAction(
  text: string,
  mediaIds: string[],
): Promise<ActionResult<Post>> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to post." };
  }

  const parsedText = postTextSchema.safeParse(text);
  if (!parsedText.success) {
    return { ok: false, error: parsedText.error.issues[0].message };
  }

  const parsedMedia = mediaIdsSchema.safeParse(mediaIds);
  if (!parsedMedia.success) {
    return { ok: false, error: parsedMedia.error.issues[0].message };
  }

  if (parsedText.data.length === 0 && parsedMedia.data.length === 0) {
    return {
      ok: false,
      error: "Write something or attach a photo before posting.",
    };
  }

  const mediaObjectIds = parsedMedia.data.map((id) => new ObjectId(id));
  if (!(await mediaExists(mediaObjectIds))) {
    return { ok: false, error: "One of the attached photos is missing." };
  }

  const profile = await getProfileByUserId(user.id);
  const nameParsed = nameSchema.safeParse(
    profile?.displayName ?? authorNameFromUser(user),
  );

  const post = await createPost({
    authorId: user.id,
    authorName: nameParsed.success ? nameParsed.data : "Anonymous",
    text: parsedText.data,
    mediaIds: mediaObjectIds,
    hashtags: extractHashtags(parsedText.data),
  });

  return { ok: true, data: post };
}

export async function toggleLikeAction(
  postId: string,
): Promise<ActionResult<{ liked: boolean; likesCount: number }>> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, error: "Sign in to like posts." };
  }

  try {
    return { ok: true, data: await toggleLike(postId, user.id) };
  } catch {
    return { ok: false, error: "Could not update that like." };
  }
}

export async function fetchFeedAction(input: {
  cursor: string | null;
  mode: string;
  tag: string | null;
  authorId: string | null;
}): Promise<{ posts: Post[]; nextCursor: string | null }> {
  const user = await currentUser();
  const mode = FEED_MODES.includes(input.mode as FeedMode)
    ? (input.mode as FeedMode)
    : "suggested";
  return getFeed({
    viewerId: user?.id ?? null,
    cursor: input.cursor,
    mode,
    tag: input.tag,
    authorId: input.authorId,
  });
}

export async function listCommentsAction(
  postId: string,
): Promise<ActionResult<{ threads: CommentThread[] }>> {
  try {
    return { ok: true, data: { threads: await listComments(postId) } };
  } catch {
    return { ok: false, error: "Could not load comments." };
  }
}

export async function addCommentAction(input: {
  postId: string;
  parentId: string | null;
  text: string;
}): Promise<
  ActionResult<{
    id: string;
    postId: string;
    parentId: string | null;
    authorId: string;
    authorName: string;
    authorUsername: string | null;
    authorAvatarMediaId: string | null;
    text: string;
    createdAt: string;
  }>
> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, error: "Sign in to comment." };
  }

  const parsedPostId = objectIdSchema.safeParse(input.postId);
  if (!parsedPostId.success) {
    return { ok: false, error: "Invalid post." };
  }

  if (
    input.parentId !== null &&
    input.parentId !== undefined &&
    input.parentId !== ""
  ) {
    const parsedParentId = objectIdSchema.safeParse(input.parentId);
    if (!parsedParentId.success) {
      return { ok: false, error: "Invalid comment to reply to." };
    }
  }

  const parsedText = commentTextSchema.safeParse(input.text);
  if (!parsedText.success) {
    return { ok: false, error: parsedText.error.issues[0].message };
  }

  const profile = await getProfileByUserId(user.id);
  const nameParsed = nameSchema.safeParse(
    profile?.displayName ?? authorNameFromUser(user),
  );

  try {
    const comment = await addComment({
      postId: parsedPostId.data,
      parentId: input.parentId || null,
      authorId: user.id,
      authorName: nameParsed.success ? nameParsed.data : "Anonymous",
      text: parsedText.data,
    });
    return { ok: true, data: comment };
  } catch {
    return { ok: false, error: "Could not post that comment." };
  }
}

export async function fetchUserCommentsAction(
  userId: string,
  cursor: string | null,
): Promise<{ comments: UserComment[]; nextCursor: string | null }> {
  return getCommentsByAuthor(userId, cursor);
}

export async function toggleFollowAction(
  followeeId: string,
): Promise<ActionResult<{ following: boolean; followersCount: number }>> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, error: "Sign in to follow people." };
  }
  if (user.id === followeeId) {
    return { ok: false, error: "You can't follow yourself." };
  }

  try {
    return { ok: true, data: await toggleFollow(user.id, followeeId) };
  } catch {
    return { ok: false, error: "Could not update that follow." };
  }
}

export async function setUpProfileAction(input: {
  username: string;
  displayName: string;
}): Promise<ActionResult<{ profile: Profile }>> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const existing = await getProfileByUserId(user.id);
  if (existing) {
    return { ok: false, error: "Your profile is already set up." };
  }

  const parsedUsername = usernameSchema.safeParse(input.username.trim().toLowerCase());
  if (!parsedUsername.success) {
    return { ok: false, error: parsedUsername.error.issues[0].message };
  }

  const parsedName = nameSchema.safeParse(input.displayName);
  if (!parsedName.success) {
    return { ok: false, error: parsedName.error.issues[0].message };
  }

  if (!(await usernameAvailable(parsedUsername.data))) {
    return { ok: false, error: "That username is already taken." };
  }

  try {
    const profile = await createProfile({
      userId: user.id,
      username: parsedUsername.data,
      displayName: parsedName.data,
    });
    return { ok: true, data: { profile } };
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return { ok: false, error: "That username is already taken." };
    }
    return { ok: false, error: "Could not set up your profile." };
  }
}

export async function updateProfileAction(input: {
  bio: string;
  avatarMediaId: string | null | undefined;
}): Promise<ActionResult<{ profile: Profile }>> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsedBio = bioSchema.safeParse(input.bio);
  if (!parsedBio.success) {
    return { ok: false, error: parsedBio.error.issues[0].message };
  }

  if (input.avatarMediaId) {
    const parsedAvatar = objectIdSchema.safeParse(input.avatarMediaId);
    if (!parsedAvatar.success) {
      return { ok: false, error: "Invalid photo reference." };
    }
    if (!(await mediaExists([new ObjectId(parsedAvatar.data)]))) {
      return { ok: false, error: "That photo is missing." };
    }
  }

  const profile = await updateProfile(user.id, {
    bio: parsedBio.data,
    ...(input.avatarMediaId !== undefined
      ? { avatarMediaId: input.avatarMediaId }
      : {}),
  });
  if (!profile) {
    return { ok: false, error: "Set up your profile first." };
  }

  return { ok: true, data: { profile } };
}

export async function checkUsernameAction(
  username: string,
): Promise<ActionResult<{ available: boolean }>> {
  const parsed = usernameSchema.safeParse(username.trim().toLowerCase());
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  return {
    ok: true,
    data: { available: await usernameAvailable(parsed.data) },
  };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
