# NewMediaSocial

A self-hosted social platform with **no algorithm** — a single global
chronological feed where everyone sees everything everyone posts. Text posts
and likes only.

Built with Next.js (React, TypeScript), MongoDB (posts + likes), Supabase
Auth (GoTrue, self-hosted — email/password accounts) and Caddy (automatic
HTTPS). The whole thing runs as **one `docker compose up -d --build`** on any
VPS.

## What's inside

| Container       | What it does                                            |
| --------------- | ------------------------------------------------------- |
| `app`           | Next.js app (feed, posting, likes, login/register)      |
| `mongo`         | MongoDB — posts + one-like-per-user (unique index)      |
| `postgres`      | Postgres — user accounts database for auth              |
| `supabase-auth` | GoTrue (Supabase Auth) — sign up, login, JWTs            |
| `caddy`         | Reverse proxy — automatic Let's Encrypt HTTPS            |

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

Note: changing `DOMAIN` or `ANON_KEY` requires a rebuild
(`docker compose up -d --build`) because they are baked into the app at
build time. Changing the secrets does not.

## Run locally (try it out)

Same steps as above, but use `DOMAIN=localhost` in `.env`. Caddy will use a
self-signed local certificate, so accept the browser warning. This runs the
exact same stack as production.

## Everyday operations

```bash
docker compose logs -f app          # follow app logs
docker compose logs -f supabase-auth # follow auth logs
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

## Architecture notes

- **Feed** — one global collection sorted by `_id` descending (ObjectIds
  embed a timestamp, so the sort is chronological). Infinite scroll pages 20
  at a time using cursor pagination — no offset drift.
- **Likes** — a separate `likes` collection with a unique index on
  `(postId, userId)`, so one-like-per-user is enforced by the database. Each
  post keeps a denormalized `likesCount`.
- **Auth** — sessions are JWTs stored in cookies by `@supabase/ssr`; the
  Next.js middleware refreshes them transparently. Server-to-server auth
  calls use the internal Docker network directly.
- **Posts** — text only, 1–500 characters, validated on the server (zod)
  inside Server Actions.

## Project layout

```
src/app          pages (feed, login, register) + server actions
src/components   Feed, ComposeBox, PostCard, LikeButton, Header
src/lib          mongo client, posts/likes data layer, supabase clients
postgres/initdb  one-time provisioning of the auth schema
Dockerfile       multi-stage build → Next.js standalone image
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


