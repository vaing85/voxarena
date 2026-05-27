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
| **Auth** | Supabase token verification + `supabaseUserId` linking; write endpoints gated by `requireAuth`; `AUTH_DEV_BYPASS` for local dev. Reads stay public. |
| **Monetization** | Song packs: `SongPack`/`Entitlement` models, `GET /store/packs`, `POST /store/checkout` (Stripe), signature-verified `POST /store/webhook` granting entitlements; locked songs gated on play. |
| **Web dev client** | `clients/web` static page served by the API; full loop + store. |
| **Shared contracts** | OpenAPI 3 spec (`shared/contracts/openapi.yaml`) + JSON-Schema events (`shared/events/`); validated by `contracts.test.ts`. |
| **Health** | `/health` reports `phase: 2`. |

**Ranked flow:** join queue (same `songId`) → on pair, **`matchId`** returned → both players `POST /performances` with `mode: "ranked_pvp"`, same `songId`, and **`matchId`** → when both scores are in, **ELO** runs and **`Match`** is **`completed`**.

**Solo vs bot:** simulates bot layers (personality + difficulty), stores two performances, completes a **`Match`**, increments human **matchesPlayed** / **matchesWon** (bot has no MMR change).

---

## ❌ Still missing (Phase 3+)

| Area | Notes |
|------|--------|
| **Scoring engine (real)** | Complete — **all five layers real**, end-to-end: web client records the **mic** (Web Audio → in-browser WAV) or uploads a WAV → `POST /performances/audio` → Node calls the PYIN service → **A pitch** + **B timing** + **C stability** + **D dynamics** + **E transitions** stored (`Song.referenceNotes` holds the reference melody). A stub fills any layer the audio can't exercise (e.g. a single-note song has no transitions). |
| **Live PvP (realtime)** | Socket.IO coordination shipped: rooms, presence, synced countdown/start, opponent-progress relay, authoritative `match:result` push on ranked finalize, and **reconnect/resume** (a dropped player doesn't forfeit; on re-join the server replays a `match:state` snapshot — resumes the in-progress countdown via `Match.startedAt`, or returns the result if it finished). Still TODO: client UI (incl. on-device match persistence + idempotent submit retry), mic streaming/WebRTC. |
| **Read endpoints** | Done: `GET /players/:id` (profile + stats), `/players/:id/performances`, `/players/:id/matches`. |
| **Cosmetics monetization** | Done: `CosmeticItem` + ownership/equip (one per category), `/cosmetics` (+checkout/equip/unequip), Stripe webhook grants both packs & cosmetics, `cosmetic.granted` event. Season pass deferred. |
| **Tournaments** | Done: single-elimination, MMR-seeded brackets (`Tournament`/`Entrant`/`Match`). Create → join → start (seeds + byes) → report scores from real performances → auto-advance to a champion. `/tournaments` (+:id, /join, /start, /report). Pure bracket logic is unit-tested. One song per tournament for v1. |
| **Anti-cheat / event consumer** | Done: in-process consumer (env-gated `ANTICHEAT_CONSUMER` + Redis) reads `voxarena:events`, runs detectors (score-total mismatch, all-perfect, submission velocity) and queues `CheatFlag`s. Review via `GET /admin/flags` + `POST /admin/flags/:id/resolve` (x-admin-token). Flag-and-queue only (no auto-bans). Next: richer signals (audio fingerprinting), auto-actions if desired. |
| **Game client** | Web app in `clients/app` (React + Vite PWA): solo record→score→leaderboard loop **and live PvP** (matchmaking → synced countdown → sing → opponent progress → result, with on-device match persistence + reconnect/resume). TODO: store checkout, Supabase login, PWA offline; native (Unity/Godot) still open. |

---

## Summary

| Phase | Status |
|-------|--------|
| **Phase 1** | Done (API + leaderboard + stub scoring). |
| **Phase 2** | Done: bots, Redis queue, ELO, plus a **real 5-layer audio scoring engine** (PYIN pitch service) wired end-to-end with mic capture. |
| **Phase 3** | Not started — live PvP, anti-cheat, tournaments. |

Next: **Phase 3** (live PvP, anti-cheat) per [MVP.md](MVP.md).
