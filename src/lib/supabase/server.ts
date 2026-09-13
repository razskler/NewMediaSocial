import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_COOKIE_NAME } from "./constants";
import { createAuthFetch } from "./internalFetch";

export async function createClient() {
  const cookieStore = await cookies();

  const internalUrl = process.env.SUPABASE_URL_INTERNAL;
  const url = internalUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anonKey, {
    cookieOptions: { name: SUPABASE_COOKIE_NAME },
    ...(internalUrl ? { global: { fetch: createAuthFetch(internalUrl) } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: safe to ignore, middleware
          // keeps the session cookies refreshed.
        }
      },
    },
  });
}
