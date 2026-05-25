# VoxArena — Pre-Development Setup

Get **everything set up before coding**. Use this as your single checklist so the most complicated app you’re building has a solid foundation.

---

## Why this doc

VoxArena is a multi-service system (auth, matchmaking, game session, scoring, pitch ML, anti-cheat) with strict requirements (server-authoritative scoring, events, fairness). Doing setup once—prerequisites, infra, accounts, repo structure, and decisions—reduces surprises and rework.

---

## Upfront costs (pre-development)

| Item | Cost | Notes |
|------|------|--------|
| **Suno (commercial music)** | **$10–30 / month** | Pro (~$10/mo) or Premier (~$30/mo). Required for commercial rights. Check [suno.com/pricing](https://suno.com/pricing) for current rates. |
| **Node, Git, Docker** | **$0** | Free. |
| **Supabase (Postgres)** | **$0** | [Free tier](https://supabase.com/pricing) for dev; or local Postgres via Docker. |
| **Redis** | **$0** | Local or free tier (e.g. Upstash). |
| **Game engine** | **$0** | Godot is free; Unity has a free tier. |
| **Python / PyTorch** (Phase 2+) | **$0** | Open source. |

**Rough total to start:** about **$10–30 for the first month** (Suno only). Everything else in the pre-dev checklist can be $0. Yearly Suno is often ~20% cheaper if you commit.

---

## 1. Prerequisites (install & verify)

| Step | What | Verify |
|------|------|--------|
| 1.1 | **Node.js 18+** and **npm 9+** | `node -v` → v18+ ; `npm -v` → 9+ |
| 1.2 | **Git** | `git --version` |
| 1.3 | **PostgreSQL** (local Docker or [Supabase](https://supabase.com)) | `DATABASE_URL` in `.env`; Supabase: Project Settings → Database URI. |
| 1.4 | **Redis** (local or cloud) | `redis-cli ping` → `PONG` (or Memurai on Windows) |
| 1.5 | **Docker + Docker Compose** (optional but recommended) | `docker compose version` — use for Postgres + Redis (see `infra/docker-compose.yml`). |

**Phase 2+ (later):** Python 3.10+, pip, PyTorch (see [PREREQUISITES.md](PREREQUISITES.md)).  
**When you build the client:** Unity 2022 LTS+ or Godot 4.x.

---

## 2. Local infrastructure (Postgres + Redis)

**Option A — Docker (recommended)**

```bash
cd competitive-singing-game/infra
docker compose up -d
```

- Postgres: `localhost:5432`, database `voxarena`, user `postgres` / password `postgres`
- Redis: `localhost:6379`
- Use in `.env`: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/voxarena`, `REDIS_URL=redis://localhost:6379`

**Option B — Supabase only**

- Create a Supabase project; copy **Database → Connection string** into `DATABASE_URL` (no local Postgres).

**Option C — Native Postgres + Redis**

- Install PostgreSQL and Redis; set `DATABASE_URL` and `REDIS_URL` in `.env`.

**Verify:** `redis-cli ping` → `PONG` ; connect to Postgres (e.g. `psql` or TablePlus).

---

## 3. API service (backend)

| Step | Action |
|------|--------|
| 3.1 | `cd services/api` |
| 3.2 | `cp .env.example .env` |
| 3.3 | Edit `.env`: set `DATABASE_URL`, `REDIS_URL`, `PORT` if needed |
| 3.4 | `npm install` |
| 3.5 | `npx prisma generate` |
| 3.6 | `npx prisma db push` (creates tables in Postgres) |
| 3.7 | `npm run db:seed` (prints `SONG_ID` and `PLAYER_ID`) |
| 3.8 | `npm run dev` |
| 3.9 | `GET /health` and `GET /health/db` return OK; optional `GET /health/redis` |
| 3.10 | `GET /songs` lists the seeded demo song; see [GETTING_STARTED.md](GETTING_STARTED.md) for `POST /performances` and `GET /leaderboard` |

Backend is ready when health and `/songs` work (and optionally Redis + leaderboard after a test performance).

---

## 4. Music (Suno) — commercial rights

| Step | Action |
|------|--------|
| 4.1 | Create a [Suno](https://suno.com) account |
| 4.2 | Subscribe to **Pro** or **Premier** (required for commercial/game use) |
| 4.3 | (When ready) Generate your first track: instrumental or full song → export **instrumental stem** + **MIDI** for reference pitch. See [MUSIC_LICENSING.md](MUSIC_LICENSING.md). |

Only music created **after** subscribing gets commercial rights.

---

## 5. Repo structure (shared & infra)

Already in place after setup:

| Path | Purpose |
|------|---------|
| `shared/events/` | Event schemas (`performance_start`, `note_result`, `performance_summary`, etc.). Add as you define them. |
| `shared/contracts/` | API contracts (OpenAPI, TypeScript types) for REST and Socket.IO. Add as you add endpoints. |
| `infra/docker-compose.yml` | Local Postgres + Redis (if using Docker). |

You don’t need to add files to `shared/` before Phase 1; the folders are there so the first event or contract has a clear home.

---

## 6. Key decisions (recorded)

See **[DECISIONS.md](DECISIONS.md)** in the repo root. It records choices (e.g. “Music: Suno paid plan”) so the team and future-you don’t forget. Add entries as you lock in architecture or product decisions.

---

## 7. Docs quick reference

| Doc | When to use it |
|-----|-----------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, scoring layers, matchmaking, anti-cheat |
| [MVP.md](MVP.md) | Phases and deliverables (Phase 1–3) |
| [STACK.md](STACK.md) | Tech stack and service responsibilities |
| [GETTING_STARTED.md](GETTING_STARTED.md) | Run the API (short version) |
| [PREREQUISITES.md](PREREQUISITES.md) | What to install and in what order |
| [MUSIC_LICENSING.md](MUSIC_LICENSING.md) | How to get songs (Suno, commissioned, etc.) |
| [REVIEW.md](REVIEW.md) | What’s done vs missing in the repo |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Railway, Supabase, Resend |
| **PRE_DEVELOPMENT_SETUP.md** (this file) | Pre-dev checklist |

---

## 8. Pre-development checklist (summary)

- [ ] Node 18+, npm, Git installed and verified
- [ ] Postgres (or Supabase) and optional Redis running
- [ ] `services/api`: `.env` set, `npm install`, `prisma generate`, `prisma db push`, `db:seed`, `npm run dev`
- [ ] `GET /health`, `GET /health/db`, and `GET /songs` return OK
- [ ] Suno account created; **Pro or Premier** subscribed (for commercial music)
- [ ] Repo has `shared/events/`, `shared/contracts/`, and `infra/docker-compose.yml` (if using Docker)
- [ ] [DECISIONS.md](../DECISIONS.md) exists and key choices (e.g. Suno) are noted

When all boxes are checked, you’re set up to start development. Begin with Phase 1: songs API, leaderboard, submit score (see [REVIEW.md](REVIEW.md)).
