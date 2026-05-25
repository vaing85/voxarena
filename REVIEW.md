# VoxArena — Project Review: What’s Missing

Review of the repo against the [ARCHITECTURE](ARCHITECTURE.md) and [MVP.md](MVP.md).

---

## ✅ In place

| Area | Status |
|------|--------|
| **Docs** | ARCHITECTURE, MVP, STACK, GETTING_STARTED, PREREQUISITES, MONETIZATION, PRE_DEVELOPMENT_SETUP, MUSIC_LICENSING, DEPLOYMENT, REVIEW. |
| **API (Phase 1 + 2)** | Songs, players, performances (with optional **ranked** `matchId`), leaderboard (excludes house bot), **Redis ranked matchmaking**, **solo vs bot** with personalities, **ELO MMR** on ranked completion, weighted **3-layer** scoring module + bot/stub generators. |
| **Prisma** | `Performance.matchId` → `Match`; `Match.status`; Postgres + Supabase. |
| **Seed** | Demo song, demo player, **VoxArena Bot** (`HOUSE_BOT_DEVICE_ID`) for `/bot/solo-vs-bot`. |
| **Infra** | `nixpacks.toml`, Docker Postgres + Redis, Railway/Supabase/Resend docs. |

---

## Phase 1 & 2 API (implemented)

| Area | Endpoints / behavior |
|------|----------------------|
| **Core** | `GET /songs`, `GET /songs/:id`, `POST /players`, `GET /leaderboard` |
| **Performances** | `POST /performances` — body includes optional **`matchId`** for **`ranked_pvp`**. Response: `{ performance, ranked }` (`ranked` is `null` unless a ranked match was finalized). |
| **Ranked** | `POST /matchmaking/ranked/join`, `POST /matchmaking/ranked/leave`, `GET /matchmaking/ranked/pending/:playerId` — **requires `REDIS_URL`**. |
| **Solo vs bot** | `GET /bot/presets`, `POST /bot/solo-vs-bot` — `botPreset`: `rookie` \| `pro` \| `metro` \| `soul`. |
| **Health** | `/health` reports `phase: 2`. |

**Ranked flow:** join queue (same `songId`) → on pair, **`matchId`** returned → both players `POST /performances` with `mode: "ranked_pvp"`, same `songId`, and **`matchId`** → when both scores are in, **ELO** runs and **`Match`** is **`completed`**.

**Solo vs bot:** simulates bot layers (personality + difficulty), stores two performances, completes a **`Match`**, increments human **matchesPlayed** / **matchesWon** (bot has no MMR change).

---

## ❌ Still missing (Phase 3+)

| Area | Notes |
|------|--------|
| **Real pitch ML** | Python + CREPE/PYIN (or similar); replace stub / heuristic layers. |
| **Socket.IO / WebRTC** | Live session sync, mic streaming ([MVP](MVP.md) Phase 3). |
| **Auth** | Supabase Auth or JWT + link `supabaseUserId`. |
| **Anti-cheat** | Fingerprinting, review queue. |
| **Shared contracts** | OpenAPI / event schemas in `shared/`. |
| **Game client** | Unity / Godot / web harness. |

---

## Summary

| Phase | Status |
|-------|--------|
| **Phase 1** | Done (API + leaderboard + stub scoring). |
| **Phase 2** | Done in this repo: bots, Redis queue, ELO, 3-layer weights + bot/stub pipelines (still heuristic, not ML pitch). |
| **Phase 3** | Not started — live PvP, anti-cheat, tournaments. |

Next: **real audio scoring**, **client**, then **Phase 3** per [MVP.md](MVP.md).
