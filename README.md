# VoxArena

**VoxArena** is a competitive singing game where scoring is server-authoritative and the platform includes **performance analytics**, **matchmaking**, **fairness**, and **anti-cheat** — not just pitch detection.

## Docs

- **[PRE_DEVELOPMENT_SETUP.md](docs/PRE_DEVELOPMENT_SETUP.md)** — **Start here.** Full checklist to get everything set up before development (prereqs, infra, API, Suno, shared folders).
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Full system design: core game loop, modes, voice scoring engine (3 layers + weights), matchmaking, ELO tiers, bot singers, anti-cheat (threat/counter), fairness, data flow, phasing.
- **[STACK.md](docs/STACK.md)** — Tech stack: Unity/Godot, Node + Prisma, **Supabase (Postgres)**, **Railway**, **Resend**, Redis, WebRTC, Socket.IO, Python + Torch (pitch + anti-cheat).
- **[PREREQUISITES.md](docs/PREREQUISITES.md)** — What to install (Node, Postgres/Supabase, Redis, Python, Unity/Godot) and how to verify.
- **[GETTING_STARTED.md](docs/GETTING_STARTED.md)** — Run the API: `.env`, `npm install`, `prisma generate`, `db push`, `db:seed`, `npm run dev`.
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Railway, Supabase, Resend env vars and deploy flow.
- **[MUSIC_LICENSING.md](docs/MUSIC_LICENSING.md)** — Getting songs without copyright issues (Suno, commissioned, royalty-free, licensing).
- **[MONETIZATION.md](docs/MONETIZATION.md)** — Clean monetization: song packs, voice skins, season passes, tournament entries; no pay-to-win.
- **[MVP.md](docs/MVP.md)** — 4–6 week build: Phase 1 (single song, pitch+timing, local leaderboard), Phase 2 (bot, ranked, voice quality), Phase 3 (live PvP, anti-cheat, tournaments).
- **[REVIEW.md](docs/REVIEW.md)** — What’s in place vs missing in the repo.
- **[DECISIONS.md](DECISIONS.md)** — Log of key product and technical decisions (e.g. Suno for music).

## Repo layout (target)

```
competitive-singing-game/
├── clients/           # Game clients (Unity / Web / etc.)
├── services/          # Auth, matchmaking, game-session, scoring, anti-cheat, analytics
├── shared/            # Event schemas, API contracts
├── infra/             # IaC, queues, DBs
└── docs/              # Architecture and stack
```

## Principles

1. **Server owns the score** — Clients send audio (or features); only the backend computes and stores the final score.
2. **Events drive analytics and anti-cheat** — Every note/phrase/performance is an event; same pipeline for fairness and detection.
3. **Matchmaking is skill + context** — MMR, region, same song/difficulty in ranked.
4. **Anti-cheat is a first-class service** — Rules + ML on event stream and optional audio fingerprinting.

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full picture.
