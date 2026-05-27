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
- `POST http://localhost:3000/performances` with JSON body **and an identity header** (see Auth below):

```bash
curl -X POST http://localhost:3000/performances \
  -H "Content-Type: application/json" \
  -H "x-player-id: <PLAYER_ID from seed>" \
  -d '{"playerId":"<PLAYER_ID from seed>","songId":"<SONG_ID from seed>","mode":"solo_practice"}'
```

(Omit score fields to use **stub** scores.)

- `GET http://localhost:3000/leaderboard?songId=<SONG_ID>` — ranked list (public, no auth)

---

## Auth

Write endpoints (`POST /players`, `/performances`, `/bot/solo-vs-bot`, `/matchmaking/*`) require an authenticated player. Reads (`/songs`, `/leaderboard`, `/bot/presets`, `/health/*`) are public.

- **Production / Supabase configured** (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`): send a Supabase access token as `Authorization: Bearer <token>`. The API verifies it and links/creates the matching `Player` (by `supabaseUserId`, or an existing unclaimed row with the same email).
- **Local dev without Supabase:** set `AUTH_DEV_BYPASS=true` in `.env` and pass `x-player-id: <PLAYER_ID>` on write requests. Token verification is skipped. This is **never** honored when `NODE_ENV=production`.

The `playerId` in a request body must match the authenticated identity, or the API returns `403`.

---

## 4. API reference (Phase 1 + 2)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/songs` | List songs |
| GET | `/songs/:id` | One song (UUID) |
| POST | `/players` | 🔒 Register/link current player. Body: `{ "name": "Optional" }` |
| GET | `/players/:id` | Public profile + stats (winRate, bestScoreTotal, performanceCount). |
| GET | `/players/:id/performances` | Recent performances (`limit`). |
| GET | `/players/:id/matches` | Recent completed matches, framed from the player's view (`limit`). |
| POST | `/performances` | 🔒 `playerId`, `songId`, `mode`; optional **`matchId`** for `ranked_pvp`. Response `{ performance, ranked }`. |
| POST | `/performances/audio` | 🔒 Multipart `audio` (WAV) + `playerId`, `songId`, `mode`. **All five scoring layers** (pitch, timing, stability, dynamics, transitions) via the pitch service. Needs `PITCH_SERVICE_URL` + song reference notes. |
| GET | `/leaderboard` | Query: `songId` (required), `limit` (optional). Excludes house bot. |
| POST | `/matchmaking/ranked/join` | 🔒 `{ playerId, songId }` — needs **Redis** |
| POST | `/matchmaking/ranked/leave` | 🔒 `{ playerId }` |
| GET | `/matchmaking/ranked/pending/:playerId` | 🔒 Current `matchId` if matched |
| GET | `/bot/presets` | Bot personality keys |
| POST | `/bot/solo-vs-bot` | 🔒 `{ playerId, songId, botPreset }` — optional full scores or stub |
| GET | `/store/packs` | Song packs; includes `owned` when authenticated |
| POST | `/store/checkout` | 🔒 `{ packId }` → Stripe Checkout `{ url }` (needs `STRIPE_SECRET_KEY`) |
| POST | `/store/webhook` | Stripe events (raw body, signature-verified) → grants entitlements & cosmetics |
| GET | `/cosmetics` | Cosmetic items; includes `owned`/`equipped` when authenticated |
| POST | `/cosmetics/checkout` | 🔒 `{ cosmeticItemId }` → Stripe Checkout `{ url }` |
| POST | `/cosmetics/equip` · `/cosmetics/unequip` | 🔒 `{ cosmeticItemId }` — one equipped per category |
| GET | `/admin/flags` | 🔑 Anti-cheat review queue (`x-admin-token`; `status`, `limit`) |
| POST | `/admin/flags/:id/resolve` | 🔑 `{ status: reviewed \| dismissed }` |

🔒 = requires auth (Bearer token, or `x-player-id` header in dev bypass). Modes: `solo_practice`, `solo_vs_bot`, `ranked_pvp`, `tournament`. Locked songs (in a pack you don't own) return `403` when you try to play them.

**Live PvP (Socket.IO):** once matchmaking pairs two players, both connect a socket (identity via handshake `auth: { token }` or `{ playerId }`) and `match:join` the `matchId`. The server coordinates presence, a synced `match:start` countdown, and `opponent:progress` relay; scores are still submitted via `/performances` and the authoritative `match:result` is pushed to the room on finalize. Event reference: [shared/contracts/README.md](../shared/contracts/README.md).

---

## 5. Next steps

- **Deploy:** [DEPLOYMENT.md](DEPLOYMENT.md) — Railway, Supabase, Resend (set **`REDIS_URL`** for ranked).
- **Phase 3**: Live PvP, WebRTC, anti-cheat ([MVP.md](MVP.md)).
- **Pitch service**: Python + Torch when ready ([STACK.md](STACK.md)).
- **Client**: Unity/Godot or web harness under `clients/`.

For gaps and roadmap see [REVIEW.md](REVIEW.md).
