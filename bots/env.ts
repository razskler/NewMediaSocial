/** Bot runner configuration, read from the environment with defaults. */

function num(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) {
    return def;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : def;
}

function str(name: string, def: string): string {
  return process.env[name]?.trim() || def;
}

export const botEnv = {
  /** How many bot accounts to create (capped by persona availability). */
  count: num("BOT_COUNT", 25),
  /** How many historical posts the seeder backfills. */
  seedPosts: num("BOT_SEED_POSTS", 400),
  /** How far back (days) the seeded history stretches. */
  seedDays: num("BOT_SEED_DAYS", 14),
  /** Use the LLM during seeding too (slower, costs tokens). Off by default. */
  seedWithLlm: process.env.BOT_SEED_WITH_LLM === "true",
  /** Random pause between daemon actions. */
  tickMinMs: num("BOT_TICK_MIN_MS", 45_000),
  tickMaxMs: num("BOT_TICK_MAX_MS", 120_000),
  /** Internal GoTrue base URL (no /auth/v1 prefix — bare GoTrue serves at root). */
  authUrl: str("SUPABASE_URL_INTERNAL", "http://supabase-auth:9999"),
  anonKey: str("ANON_KEY", str("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")),
  /** Deterministic bot passwords (re-runs and logins stay stable). */
  passwordSecret: str("BOT_PASSWORD_SECRET", "newmediasocial-bots"),
  /** Optional OpenAI-compatible LLM; templates are used when the key is absent. */
  llmApiKey: process.env.BOT_LLM_API_KEY?.trim() || null,
  llmBaseUrl: str("BOT_LLM_BASE_URL", "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  ),
  llmModel: str("BOT_LLM_MODEL", "gpt-4o-mini"),
} as const;
