# NewMediaSocial

A self-hosted social platform — posts with photos, hashtags, comments,
follows and DMs, with a ranked "Suggested" feed next to chronological
"Following" and topic tabs. An optional **bots** profile seeds fake AI
users and keeps the instance feeling alive (great for testing feed
algorithms).

Built with Next.js (React, TypeScript), MongoDB (posts, likes, comments,
follows, profiles), Supabase Auth (GoTrue, self-hosted — email/password
accounts) and Caddy (automatic HTTPS). The whole thing runs as **one
`docker compose up -d --build`** on any VPS.

## What's inside

| Container       | What it does                                            |
| --------------- | ------------------------------------------------------- |
| `app`           | Next.js app (feed, posting, likes, login/register)      |
| `mongo`         | MongoDB — posts + one-like-per-user (unique index)      |
| `postgres`      | Postgres — user accounts database for auth              |
| `supabase-auth` | GoTrue (Supabase Auth) — sign up, login, JWTs            |
| `caddy`         | Reverse proxy — automatic Let's Encrypt HTTPS            |
| `bots`          | Optional fake users: seeder + live-activity daemon      |

Only Caddy is exposed to the internet (ports 80/443). Mongo, Postgres and the
auth API live on the private Docker network. Auth is served under
`/auth/v1/*` on your own domain — no third-party services, no CORS.

## Deploy on a VPS

Requirements: any VPS with 1 GB+ RAM running Linux, Docker + Docker Compose
installed, and a domain (or subdomain) pointed at the VPS IP with a DNS
**A record**.

```bash
# 1. Get the code onto your VPS
git clone <your-repo-url> && cd NewMediaSocial

# 2. Create your config
cp .env.example .env

# 3. Fill it in (generate the secrets with the commands in the file)
nano .env

# 4. Launch
docker compose up -d --build
```

That's it. Caddy obtains the HTTPS certificate automatically on first visit.
Open `https://your-domain.com`, click **Sign up**, and start posting.

Values in `.env`:

| Variable           | Required | Notes                                        |
| ------------------ | -------- | -------------------------------------------- |
| `DOMAIN`           | yes      | Domain pointing at the VPS                   |
| `JWT_SECRET`       | yes      | `openssl rand -hex 32`                       |
| `MONGO_PASSWORD`   | yes      | `openssl rand -hex 16`                       |
| `POSTGRES_PASSWORD`| yes      | `openssl rand -hex 16`                       |
| `ANON_KEY`         | no       | Any random string the app uses as its API key |
| `BOT_*`            | no       | Optional bots profile — see [Bots](#bots-fake-users) below |

Note: changing `DOMAIN` or `ANON_KEY` requires a rebuild
(`docker compose up -d --build`) because they are baked into the app at
build time. Changing the secrets does not.

## Run locally (try it out)

Same steps as above, but use `DOMAIN=localhost` in `.env`. Caddy will use a
self-signed local certificate, so accept the browser warning. This runs the
exact same stack as production.

To run locally just run: "docker compose up -d --build" and then type:
"localhost" in your browser.

## Everyday operations

```bash
docker compose logs -f app          # follow app logs
docker compose logs -f supabase-auth # follow auth logs
docker compose logs -f bots         # follow bot activity (if enabled)
docker compose restart app           # restart just the app
docker compose pull && docker compose up -d --build   # deploy an update
```

### Backups

Posts and likes (MongoDB):

```bash
docker compose exec mongo mongodump -u root -p "$MONGO_PASSWORD" --authenticationDatabase admin --db newmediasocial --archive > backup.archive
```

User accounts (Postgres):

```bash
docker compose exec postgres pg_dump -U postgres supabase_auth > backup.sql
```

Restore a Mongo archive with
`docker compose exec -T mongo mongorestore -u root -p "$MONGO_PASSWORD" --authenticationDatabase admin --archive < backup.archive`.

### Enabling email confirmation (optional, later)

By default accounts are activated instantly (no email server needed — set
via `GOTRUE_MAILER_AUTOCONFIRM=true`). If you later want real email
confirmation or password-reset emails, add SMTP settings to the
`supabase-auth` service in `docker-compose.yml` (`GOTRUE_SMTP_HOST`,
`GOTRUE_SMTP_PORT`, `GOTRUE_SMTP_USER`, `GOTRUE_SMTP_PASS`,
`GOTRUE_SMTP_ADMIN_EMAIL`) and set `GOTRUE_MAILER_AUTOCONFIRM=false`.

## Bots (fake users)

The `bots` compose profile creates fake users that post, like, comment,
reply and follow — a backfilled history first (so feeds and trending
hashtags look lived-in immediately), then a slow drip of live activity.
Great for demoing the platform and for testing feed-ranking changes
against realistic data.

```bash
# Start the stack plus bots (seeds once on first boot, then stays live)
docker compose --profile bots up -d --build

# Seed only, without the ongoing daemon
docker compose --profile bots run --rm -T bots npx tsx bots/main.ts seed

# Re-seed from scratch (adds another round of history)
docker compose --profile bots run --rm -T bots npx tsx bots/main.ts seed --force

# Remove every bot account, post, like, comment and follow (real users'
# counters are fixed up; real content is untouched)
docker compose --profile bots stop bots
docker compose --profile bots run --rm -T bots npx tsx bots/main.ts purge

# Stop the live activity (the rest of the stack keeps running)
docker compose --profile bots stop bots
```

Bots are ordinary users: real GoTrue accounts (auto-confirmed,
`@bots.local` emails, deterministic passwords) with profiles, so they show
up in feeds, topics and follower lists exactly like anyone else. They are
not flagged as bots in the UI.

**Content source** — without any extra config, bots draw from built-in
persona templates (free). Set `BOT_LLM_API_KEY` and they generate posts and
comments with an LLM instead, using any OpenAI-compatible API, falling back
to templates automatically on any error:

| Variable             | Default                      | Notes                                      |
| -------------------- | ---------------------------- | ------------------------------------------ |
| `BOT_COUNT`          | `25`                         | Bot accounts to create                     |
| `BOT_SEED_POSTS`     | `400`                        | Historical posts to backfill               |
| `BOT_SEED_DAYS`      | `14`                         | How far back the history stretches         |
| `BOT_TICK_MIN_MS`    | `45000`                      | Min pause between live actions             |
| `BOT_TICK_MAX_MS`    | `120000`                     | Max pause between live actions             |
| `BOT_LLM_API_KEY`    | *(empty → templates)*        | API key for an OpenAI-compatible endpoint  |
| `BOT_LLM_BASE_URL`   | `https://api.openai.com/v1`  | Works with OpenRouter, Groq, Ollama, etc.  |
| `BOT_LLM_MODEL`      | `gpt-4o-mini`                | Model name for the endpoint above          |
| `BOT_SEED_WITH_LLM`  | `false`                      | Also use the LLM for the initial backfill (slower, costs tokens) |
| `BOT_PASSWORD_SECRET`| `newmediasocial-bots`        | Seed for the bots' deterministic passwords |

A quick local end-to-end test of ranking changes: seed, tweak
`RANKING_CONFIG` in `src/lib/ranking.ts`, rebuild the app, and compare the
Suggested tab — the seeded engagement is deliberately skewed (a few viral
posts, many quiet ones) to make ranking differences visible.

## Architecture notes

- **Feed** — one global collection sorted by `_id` descending (ObjectIds
  embed a timestamp, so the sort is chronological). Infinite scroll pages 20
  at a time using cursor pagination — no offset drift.
- **Likes** — a separate `likes` collection with a unique index on
  `(postId, userId)`, so one-like-per-user is enforced by the database. Each
  post keeps a denormalized `likesCount`.
- **Auth** — sessions are JWTs stored in cookies by `@supabase/ssr`; the
  Next.js middleware refreshes them transparently. Server-to-server auth
  calls use the internal Docker network directly (a small fetch wrapper
  strips the `/auth/v1` prefix, since bare GoTrue serves its API at the
  root and there is no gateway in front of it).
- **Posts** — text only, 1–500 characters, validated on the server (zod)
  inside Server Actions.

## Project layout

```
src/app          pages (feed, login, register) + server actions
src/components   Feed, ComposeBox, PostCard, LikeButton, Header
src/lib          mongo client, posts/likes data layer, supabase clients
bots/            fake-user seeder + live-activity daemon (compose profile)
postgres/initdb  one-time provisioning of the auth schema
Dockerfile       multi-stage build → Next.js standalone image + bots stage
docker-compose.yml   the whole stack
Caddyfile        routing + TLS
```

## Note worth knowing
- App — Next.js 15 + TypeScript: global chronological feed with infinite scroll (cursor pagination on _id), 500-char text posts with live counter, optimistic one-like-per-user hearts, login/register/logout, zod-validated Server Actions.
- Auth — supabase/auth (GoTrue v2.197.0) + Postgres, self-hosted and routed at /auth/v1/* on your domain via Caddy; auto-confirm on, no SMTP needed.
- Data — MongoDB: posts with denormalized likesCount, likes with a unique (postId, userId) index enforcing one-like-per-user at the DB level.
- Deploy — multi-stage Dockerfile (Node 22 alpine, standalone output, ~317 MB), docker-compose.yml with all 5 containers, healthchecks, and a one-time initdb script that provisions the auth schema GoTrue expects. Config surface is 5 values in .env.
Verified live (full stack in Docker): signup → session issued instantly → JWT signature validated against JWT_SECRET → password login → posts inserted in Mongo rendered in the feed HTML → duplicate like rejected by the unique index → all containers healthy, no app errors. Test stack was torn down cleanly afterwards.
To deploy on your VPS: git clone → cp .env.example .env (fill DOMAIN + 3 generated secrets) → docker compose up -d --build — Caddy handles HTTPS automatically. Local trial works the same with DOMAIN=localhost (accept the self-signed cert warning). Full guide is in the README.
Two things worth knowing: changing DOMAIN/ANON_KEY requires a rebuild (they're baked into the client bundle), and the Postgres auth volume must be fresh on first boot for the initdb script to run — on a new VPS that's automatic.


