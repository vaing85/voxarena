# VoxArena — Decisions log

Record important product and technical decisions so the team (and future-you) don’t forget.

---

## Music / songs

| Decision | Date | Notes |
|----------|------|--------|
| **Use Suno AI for generated music; pay for commercial rights** | 2025-02 | Pro or Premier subscription so we own output and can use in-game (sync). Generate instrumentals + export MIDI for reference pitch. See [docs/MUSIC_LICENSING.md](docs/MUSIC_LICENSING.md). |

---

## Architecture

| Decision | Date | Notes |
|----------|------|--------|
| **Host API on Railway** | 2026-04 | Node service from `services/api`; env vars in Railway dashboard. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). |
| **Database: Supabase (PostgreSQL)** | 2026-04 | Prisma `DATABASE_URL` points at Supabase Postgres; optional `supabaseUserId` on `Player` for Auth linkage. Local dev: Docker Postgres or Supabase project. |
| **Email: Resend** | 2026-04 | `RESEND_API_KEY` + `RESEND_FROM`; `sendTransactionalEmail()` in `services/api/src/lib/email.ts`. |
| **Phase 1: single API service** | — | Auth, matchmaking, game session split later or as modules. |

---

## How to use this file

- Add a new row when you make a decision that affects design, stack, or product.
- Keep entries short; link to docs (ARCHITECTURE, MVP, MUSIC_LICENSING) for detail.
