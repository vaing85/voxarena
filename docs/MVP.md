# VoxArena — MVP (4–6 Week Build)

Three phases, ~2 weeks each.

---

## Phase 1 (~2 weeks)

| Deliverable | Details |
|-------------|---------|
| **Single song** | One track, one difficulty; full play-through. |
| **Pitch + timing scoring** | Layer A (pitch: YIN/CREPE/PYIN) + Layer B (timing windows: perfect/good/miss). |
| **Local leaderboard** | Best scores stored locally (or simple backend); no PvP yet. |

**Stack**: Client (Unity/Godot) + Node backend + Redis/DB for scores; optional Python pitch service.

---

## Phase 2 (~2 weeks)

| Deliverable | Details |
|-------------|---------|
| **AI bot opponent (Solo vs Bot)** | At least one bot personality (e.g. Rookie or Pro); pitch accuracy %, reaction time, drift, note skip. |
| **Ranked ladder** | ELO/MMR; tiers (Bronze → Master); matchmaking by vocal rating + song difficulty. |
| **Voice quality stats** | Layer C in scoring: stability, dynamics, transitions; weighted total (e.g. 40% pitch, 25% timing, 15% stability, 10% dynamics, 10% transitions). |

**Stack**: Matchmaking (Redis), Player DB (Postgres / Supabase), scoring engine with full 3-layer pipeline.

---

## Phase 3 (~2 weeks)

| Deliverable | Details |
|-------------|---------|
| **Live PvP (1v1)** | Same song, same difficulty; WebRTC mic streaming; server-authoritative scoring; Socket.IO room sync. |
| **Anti-cheat** | Audio fingerprint (replay / original track); flag impossible pitch curves and latency patterns; review queue (no auto-ban in v1). |
| **Tournaments** | Brackets; optional prize pool; same scoring and fairness rules. |

**Stack**: Game session service, WebRTC + Socket.IO, anti-cheat pipeline (Python + Node), tournament state in Postgres (Supabase).

---

## After MVP

- Battle Royale mode.
- Team Duets (harmonies).
- Full ML anti-cheat (formant/synth detection).
- Monetization: song packs, voice skins, season passes, tournament entries (see [MONETIZATION.md](MONETIZATION.md)).
