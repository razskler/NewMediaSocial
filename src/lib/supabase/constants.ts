/**
 * Explicit session cookie name shared by the browser, server and
 * middleware Supabase clients. @supabase/ssr derives the cookie name
 * from the client URL when this is not set — but the browser client
 * uses the public URL while the server uses the internal Docker URL,
 * which would produce two different cookie names and the server would
 * never see the browser's session. Pinning one URL-independent name
 * fixes that.
 */
export const SUPABASE_COOKIE_NAME = "sb-newmediasocial-auth-token";
