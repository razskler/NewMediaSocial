const AUTH_PREFIX = "/auth/v1";

/**
 * GoTrue (Supabase Auth) serves its API at the root path, but supabase-js
 * always appends "/auth/v1" to the base URL — in the hosted product that
 * prefix is stripped by the API gateway (Kong) in front of GoTrue. When a
 * server-side client talks to the auth container directly
 * (SUPABASE_URL_INTERNAL), there is no gateway, so this fetch wrapper
 * strips the prefix before the request leaves the container.
 */
export function createAuthFetch(baseUrl: string) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    return fetch(url.replace(`${baseUrl}${AUTH_PREFIX}`, baseUrl), init);
  };
}
