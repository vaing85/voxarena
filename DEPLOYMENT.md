# VoxArena — Deployment (Railway, Supabase, Resend)

This project is set up to use **Railway** for the API, **Supabase** for PostgreSQL (and later Auth / Storage), and **Resend** for transactional email.

---

## Supabase (database)

1. Create a project at [supabase.com](https://supabase.com).
2. **Settings → Database → Connection string** — copy the **URI** (use **Session** mode for Prisma migrations, or **Transaction** with PgBouncer on port 6543 for serverless; for Railway long-running Node, direct `5432` is fine).
3. Set `DATABASE_URL` in Railway (and local `.env`) to that URI.  
   - Prisma expects PostgreSQL: `postgresql://postgres.[ref]:[password]@aws-0-...pooler.supabase.com:6543/postgres?pgbouncer=true` or direct port `5432` without pgbouncer for migrations.

**First deploy:** from `services/api` run locally against the Supabase DB:

```bash
npx prisma db push
npm run db:seed
```

Or use `prisma migrate dev` once you add migration files.

**Optional:** Enable **Row Level Security** on tables later if clients read Supabase directly; the API uses the service role / DB URL and bypasses RLS when using the direct Postgres connection.

---

## Railway (API host)

1. Create a project at [railway.app](https://railway.app).
2. **New → GitHub repo** (or deploy from CLI) and set the **root directory** to `services/api` if the monorepo root is the repo.
3. Add **variables** (same names as `.env.example`):
   - `DATABASE_URL` — Supabase connection string
   - `REDIS_URL` — optional: add a **Redis** plugin on Railway or use Upstash URL
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from Supabase **Settings → API**
   - `RESEND_API_KEY`, `RESEND_FROM` — when you send email
   - Railway injects `PORT` — do not override unless needed.

4. **Build / start:** This repo includes **`services/api/nixpacks.toml`**: `npm ci` → `prepare` runs **`prisma generate`** → `npm run build` (`tsc`) → **`npm start`**. In Railway, set the service **root directory** to `services/api` so Nixpacks picks up that file.

5. **Public URL:** Railway assigns a domain; use it for the game client’s API base URL.

---

## Resend (email)

1. Sign up at [resend.com](https://resend.com).
2. Create an API key → `RESEND_API_KEY`.
3. Add and verify a **domain** (DNS) or use Resend’s test sender for development.
4. Set `RESEND_FROM` to a verified address, e.g. `VoxArena <noreply@yourdomain.com>`.

The API exposes `GET /health/resend` — `configured` when both `RESEND_API_KEY` and `RESEND_FROM` are set. Use `sendTransactionalEmail()` in `src/lib/email.ts` from your auth or notification flows.

---

## Environment summary

| Variable | Where | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Supabase + Railway | Prisma / Postgres |
| `REDIS_URL` | Railway Redis or Upstash | Queues (Phase 2+) |
| `SUPABASE_URL` | Supabase project | Server client + future Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (secret) | Server-only admin API |
| `SUPABASE_ANON_KEY` | Supabase | Optional (edge / public rules) |
| `RESEND_API_KEY` | Resend | Send email |
| `RESEND_FROM` | Resend | Verified sender |
| `PORT` | Railway | HTTP port (auto) |

---

## Local development

Use `infra/docker-compose.yml` for **Postgres + Redis** locally, or point `DATABASE_URL` at Supabase’s dev database. See [GETTING_STARTED.md](GETTING_STARTED.md).
