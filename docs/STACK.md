# VoxArena — Real System Stack

Single reference for the technology stack. Aligned with **Node**, **Prisma**, **Supabase (Postgres)**, **Railway**, and **Resend**.

---

## Stack table

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Client** | Unity / Godot | Game UI, mic capture, real-time feedback; never final score authority |
| **Audio (client)** | WebRTC + WASM DSP | Mic streaming to server; optional client-side preview/DSP |
| **AI Pitch** | Python + Torch | YIN / CREPE / PYIN or neural pitch; server-side or feature export to Node |
| **Backend** | Node + Prisma | REST/API, game session, matchmaking, persistence |
| **Hosting (API)** | Railway | Run Node service, env vars, optional Redis plugin |
| **Database** | **Supabase (PostgreSQL)** | Prisma `DATABASE_URL`; Auth + Storage when you wire them |
| **Email** | **Resend** | Transactional email (verification, notifications) |
| **Realtime** | Socket.IO / WebRTC | Room sync, duel state, server-authoritative result push |
| **Matchmaking** | Redis | Queues, MMR bands, session state, rate limit |
| **Scoring** | Node + Python (pitch) | Audio/features → pitch/timing/quality → score, event emit |
| **Anti-Cheat** | Python (Torch ML) + Node (rules) | Formant/spectral models, fingerprint, trust score |
| **Media** | S3 / GCS / Supabase Storage + CDN | Backing tracks, stems, reference pitch data |

---

## Service → responsibility

| Service | Owns | Talks to |
|---------|------|----------|
| **Auth** | Identity (Supabase Auth optional), device binding, JWT | Player DB (Prisma / Postgres) |
| **Matchmaking** | Queue (Redis), MMR lookup, session create | Postgres (players), Game Session |
| **Game Session** | Room state, round flow, result delivery | Scoring, Postgres/Redis, Socket.IO |
| **Scoring** | Audio → metrics → score, event emit | Python pitch service or in-process; Postgres events |
| **Anti-Cheat** | Rules + ML, trust score, flags | Event stream, Postgres (read); review queue (write) |
| **Email** | Transactional sends | Resend API |

---

## Data flow (stack view)

```
Client (Unity/Godot) → WebRTC/Socket.IO → Game Session (join)
       ↓
  Mic → WebRTC / chunked → Scoring (Node + Python pitch)
                         → Postgres (Supabase) + Anti-Cheat
                         → Game Session (score) → Client (result only)
                         → Redis (session) + Postgres (MMR, match result)
```

---

## Optional swaps

- **Pitch**: Run CREPE/PYIN in Python microservice; Node calls via HTTP/gRPC or queue.
- **Client**: Add Web (Capacitor) later for fast iteration; Unity/Godot for best audio and polish.

This is the **real system stack** for **VoxArena**: Node, Prisma, **Supabase Postgres**, **Railway**, **Resend**, Redis, Unity/Godot, WebRTC, Python+Torch for pitch and anti-cheat.
