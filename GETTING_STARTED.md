# VoxArena — Getting Started

cdFollow this after installing [prerequisites](PREREQUISITES.md) (Node + PostgreSQL or Supabase; Redis optional for `/health/redis`).

---

## 1. Install prerequisites

See [docs/PREREQUISITES.md](PREREQUISITES.md). For Phase 1 backend: **Node 18+**, **PostgreSQL** (local Docker or **Supabase**). **Redis** is optional until matchmaking (use [docker-compose](../infra/docker-compose.yml) for local Postgres + Redis).

---

## 2. Backend (Node + Prisma)

```bash
cd competitive-singing-game/services/api
cp .env.example .env
# Edit .env: set DATABASE_URL (Supabase URI or local Postgres) and optionally REDIS_URL, Supabase, Resend
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

- **DATABASE_URL**: e.g. `postgresql://postgres:postgres@localhost:5432/voxarena` (Docker) or Supabase **Settings → Database → URI**.
- **REDIS_URL**: e.g. `redis://localhost:6379` (omit to skip Redis; `/health/redis` reports `skipped`).
- **Supabase / Resend**: optional for Phase 1; see [DEPLOYMENT.md](DEPLOYMENT.md).

The seed prints **`SONG_ID`** and **`PLAYER_ID`** (UUIDs) — use them for `POST /performances` and `GET /leaderboard`.

---

## 3. Verify

- `GET http://localhost:3000/health` — `{ "ok": true, ... }`
- `GET http://localhost:3000/health/db` — Postgres reachable
- `GET http://localhost:3000/health/redis` — Redis OK, or `skipped` without `REDIS_URL`
- `GET http://localhost:3000/health/supabase` — `configured` or `skipped`
- `GET http://localhost:3000/health/resend` — `configured` or `skipped`
- `GET http://localhost:3000/songs` — list includes seeded demo song
- `POST http://localhost:3000/performances` with JSON body:

```json
{
  "playerId": "<PLAYER_ID from seed>",
  "songId": "<SONG_ID from seed>",
  "mode": "solo_practice"
}
```

(Omit score fields to use **stub** scores.)

- `GET http://localhost:3000/leaderboard?songId=<SONG_ID>` — ranked list

---

## 4. API reference (Phase 1 + 2)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/songs` | List songs |
| GET | `/songs/:id` | One song (UUID) |
| POST | `/players` | Body: `{ "name": "Optional" }` — create test player |
| POST | `/performances` | `playerId`, `songId`, `mode`; optional **`matchId`** for `ranked_pvp`. Response `{ performance, ranked }`. |
| GET | `/leaderboard` | Query: `songId` (required), `limit` (optional). Excludes house bot. |
| POST | `/matchmaking/ranked/join` | `{ playerId, songId }` — needs **Redis** |
| POST | `/matchmaking/ranked/leave` | `{ playerId }` |
| GET | `/matchmaking/ranked/pending/:playerId` | Current `matchId` if matched |
| GET | `/bot/presets` | Bot personality keys |
| POST | `/bot/solo-vs-bot` | `{ playerId, songId, botPreset }` — optional full scores or stub |

Modes: `solo_practice`, `solo_vs_bot`, `ranked_pvp`, `tournament`.

---

## 5. Next steps

- **Deploy:** [DEPLOYMENT.md](DEPLOYMENT.md) — Railway, Supabase, Resend (set **`REDIS_URL`** for ranked).
- **Phase 3**: Live PvP, WebRTC, anti-cheat ([MVP.md](MVP.md)).
- **Pitch service**: Python + Torch when ready ([STACK.md](STACK.md)).
- **Client**: Unity/Godot or web harness under `clients/`.

For gaps and roadmap see [REVIEW.md](REVIEW.md).
