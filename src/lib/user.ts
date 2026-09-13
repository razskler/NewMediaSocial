export function authorNameFromUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const metadataName = user.user_metadata?.display_name;
  if (typeof metadataName === "string" && metadataName.trim().length > 0) {
    return metadataName.trim().slice(0, 50);
  }
  return user.email?.split("@")[0] ?? "Anonymous";
}
