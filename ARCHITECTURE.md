# VoxArena — Real Architecture

**Not just pitch scoring.**  
Performance analytics + matchmaking + fairness + anti-cheat.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS (Mobile / Desktop / Web)                     │
│  • Audio capture (mic)  • Real-time pitch/timing feedback  • Signed requests       │
└─────────────────────────────────────────────────────────────────────────────────┘
                    │                    │                    │
                    ▼                    ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐
│   Auth &     │  │  Matchmaking │  │  Game Session │  │  Analytics & Anti-Cheat  │
│   Identity   │  │  Service     │  │  (Real-time)  │  │  Pipeline                │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────────────────┘
        │                 │                 │                        │
        └─────────────────┴─────────────────┴────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
            ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
            │  Player DB   │      │  Match DB    │      │  Events /    │
            │  (skill,     │      │  (state,     │      │  Time-series │
            │   history)   │      │   results)   │      │  (metrics)   │
            └──────────────┘      └──────────────┘      └──────────────┘
```

---

## 2. Core Game Loop (What the Player Experiences)

### 2.1 Modes

| Mode | Description |
|------|-------------|
| **Solo Practice** | Sing vs AI score curve (no opponent) |
| **Solo vs Bot** | Bot simulates real human pitch mistakes; vocal personality (see §4) |
| **Ranked PvP** | 1v1 or Battle Royale singing; ELO/rank updates |
| **Team Duets** | Harmonies scored together (combined vocal rating) |
| **Tournament Mode** | Brackets + prize pools |

### 2.2 Flow (per round)

1. **Song selected** (by mode: practice pool, bot choice, matchmaking, or tournament pool).
2. **Real-time pitch tracking** — client shows feedback; server computes authoritative score from streamed audio.
3. **Phrase-by-phrase scoring** — window scoring (perfect / good / miss); combo multipliers.
4. **Final performance rating** — weighted blend of pitch, timing, stability, dynamics, transitions (see §3).
5. **Rank/ELO update** — in ranked/tournament; applied server-side after match.

---

## 3. Tech Stack (Matches Your Ecosystem)

Since you already use **Node**, **Prisma**, and **AI pipelines**:

| Layer | Technology | Role |
|-------|------------|------|
| **Client** | Unity / Godot | Game UI, mic capture, real-time feedback; **never** final score authority |
| **Audio (client)** | WebRTC + WASM DSP | Mic streaming + optional client-side preview/feedback |
| **AI Pitch** | Python + Torch | YIN/CREPE/PYIN or neural pitch; can run server-side or feed features to Node |
| **Backend** | Node + Prisma | API, game session orchestration, matchmaking, persistence |
| **Realtime** | Socket.IO / WebRTC | Live duel state, room sync, server-authoritative result delivery |
| **Storage** | **PostgreSQL** (Supabase + Prisma) | Profiles, MMR, match history, events; Auth/Storage via Supabase when integrated |
| **Matchmaking** | Redis | Queues, MMR bands, session state, rate limit |
| **Scoring Engine** | Node + Python (pitch) | Receives audio/features, computes pitch/timing/quality server-side |
| **Anti-Cheat** | Python + Torch (ML) + Node (rules) | Formant/spectral models, fingerprint, trust score |
| **Media** | S3 / GCS + CDN | Backing tracks, stems, reference pitch data |

**Why this stack**

- **Server-authoritative scoring** → clients send raw/processed audio or feature vectors; score is computed and stored only on the backend. Prevents score hacking.
- **Event-driven analytics** → every performance (pitch, timing, difficulty) is an event; enables fairness (normalization) and anti-cheat (statistical outliers).
- **Dedicated matchmaking** → skill (MMR), region, and song preference in one place; can tune for fairness and queue time.
- **Anti-cheat as a service** → ingest same events + optional audio hashes; output trust score and flags.

---

## 4. Voice Scoring Engine (The Hard Part — 3 Layers)

You need three layers; this is where you beat SingStar.

### 4.1 Layer A — Pitch Detection

- **Algorithms**: YIN / CREPE / PYIN (or server-side equivalent).
- **Role**: Converts mic input → frequency → musical note (e.g. MIDI note + cents).
- **Output**: Per-frame or per-note pitch estimate for comparison to reference.

### 4.2 Layer B — Timing Accuracy

- **Measures**: Latency vs expected note start/end.
- **Window scoring**: e.g. **perfect** / **good** / **miss** (configurable thresholds in ms).
- **Feeds**: Combo multipliers, phrase score, and overall timing stat.

### 4.3 Layer C — Vocal Quality Metrics

| Metric | Description | Beats “just pitch” by |
|--------|-------------|----------------------|
| **Vibrato stability** | Consistency of oscillation, not wobble | Technique |
| **Pitch drift** | Unwanted drift during sustained notes | Stability |
| **Note transitions** | Cleanness of attack/release between notes | Transitions |
| **Breath control** | Sustain length, consistency of support | Sustain |
| **Dynamic range** | Volume curve vs reference (optional) | Expression |

### 4.4 Weighted Final Score (tunable)

| Stat | Weight | Notes |
|------|--------|-------|
| **Pitch** | 40% | Core accuracy (cents deviation) |
| **Timing** | 25% | Window scoring (perfect/good/miss) |
| **Stability** | 15% | Vibrato + pitch drift |
| **Dynamics** | 10% | Dynamic range vs reference |
| **Transitions** | 10% | Note-to-note clarity |

Overall performance rating = weighted sum; **tuned per song/difficulty** for fairness.

### 4.5 Stored Events (for analytics + anti-cheat)

- `performance_start` / `performance_end` (song_id, difficulty, user_id, device_id, session_id).
- `note_result` (pitch_error_cents, timing_error_ms, duration_ms, expected_pitch, …).
- `phrase_result` (aggregate metrics per phrase).
- `performance_summary` (final score, subscores, duration, checksum/hash of input).

All stored with **server timestamp**, **session id**, and **device fingerprint** for integrity.

---

## 5. Matchmaking & Multiplayer Engine

### 5.1 ELO-style ranking (tiers)

**Bronze → Silver → Gold → Platinum → Diamond → Master**

- MMR/ELO drives tier; tier is display only (e.g. for matchmaking and rewards).
- Players matched by: **vocal rating** (MMR), **song difficulty**, **latency region**.

### 5.2 Matchmaking inputs

- **Skill (MMR)** — from competitive results; separate or combined for different modes (e.g. 1v1, ranked, casual).
- **Region / latency** — optional; prefer same region or max RTT.
- **Song pool / preference** — e.g. “same song”, “same difficulty”, “any”.
- **Queue time** — relax MMR range over time (e.g. ±50 → ±100 after 30s).

### 5.3 Sync & authority

- **WebRTC mic streaming** (or chunked upload) → server receives audio.
- **Server-authoritative scoring** — only server computes and stores score.
- **Client only visualizes** — real-time feedback from server or from local preview; final result always from server.

### 5.4 Flow

1. Player enters queue with **mode**, **song preference**, **region**.
2. Matchmaking service pulls **MMR** and **recent history** from Player DB.
3. Find candidate(s) within **MMR band** (and region if enforced).
4. Create **game session** (e.g. in Redis + DB), assign **room_id**, return **join token** to both clients.
5. Clients connect to **Game Session** (WebSocket); session orchestrates round (e.g. countdown, play, submit, result).

### 5.5 Fairness in matchmaking

- **Same song + same difficulty** in ranked so that scores are comparable.
- **MMR updates** use **expected score** (e.g. from historical difficulty of the song), not raw points, so harder songs don’t over-inflate MMR.
- Optional **role or handicap** (e.g. lower MMR gets slight score bonus) — tune carefully to avoid abuse.

---

## 6. Bot Singers (AI Opponents)

Bots simulate human-like mistakes for Solo vs Bot and practice. Each bot is defined by:

| Parameter | Meaning |
|-----------|---------|
| **Pitch accuracy %** | How often they hit the note (e.g. 70% → 30% “wrong” notes) |
| **Reaction time** | Delay vs reference (ms) — simulates human latency |
| **Drift tendency** | Pitch drift during sustained notes |
| **Note skip chance** | Probability of missing a note entirely |

### 6.1 Vocal personalities (presets)

| Bot | Style |
|-----|--------|
| **Metro** | Robotic, near-perfect pitch; low variance |
| **Soul** | Vibrato-heavy; more stability/dynamics variance |
| **Rookie** | Late notes; higher timing error, lower pitch accuracy |
| **Pro** | Near-human variance; balanced stats, believable curve |

Use these as templates; tune parameters per difficulty (e.g. Rookie = 60% pitch, 150 ms reaction; Pro = 92% pitch, 40 ms reaction).

---

## 7. Fairness (Beyond Matchmaking)

### 7.1 Score normalization

- **Per-song, per-difficulty calibration**: store historical score distribution (e.g. mean, std) and optionally map to a “normalized skill” score so that a 85 on a hard song is comparable to 90 on an easy one.
- **Display**: show both “raw” score and “competitive” or “normalized” score where relevant.

### 7.2 Input / device fairness

- **Calibration flow**: e.g. “sing this note” → infer mic/interface bias and store **per-device offset** (or reject clearly broken devices).
- **Latency compensation**: if timing is server-derived from uploaded chunks, use **round-trip or one-way latency** to shift windows (same for all in the same match).

### 7.3 No pay-to-win

- **Songs / difficulties** unlock by progression or purchase; **scoring weights and formula** are identical for everyone. No “score boost” items in ranked.

---

## 8. Anti-Cheat (Critical for Competitive)

### 8.1 Principles

- **Server is the source of truth**: client sends **audio (or server-defined feature stream)**, not final score.
- **Integrity**: signed requests, session tokens, device binding to limit account sharing and replay reuse.
- **Detection**: statistical + ML on **event stream** and optional **audio fingerprinting**.

### 8.2 Threat → counter (concrete)

| Threat | Counter |
|--------|---------|
| **Playing original track** | Audio fingerprint detection (match vs known stems / release) |
| **Auto-tune on input** | Formant distortion detection (unnatural formant stability) |
| **Pre-recorded vocals** | Phase & latency analysis (impossible RTT, no live variance) |
| **AI voice / synth** | Spectral irregularity model (ML on spectral/temporal features) |
| **Score manipulation** | Only server computes score; client never sends “my score”. |
| **Replay / same take twice** | Audio fingerprint; detect identical or near-identical waveforms across sessions. |
| **Modified client** | Integrity checks (client build hash), rate limit, request anomaly. |
| **Account sharing** | Device fingerprint + session binding; flag same “performance fingerprint” from many devices. |

### 8.3 What you can flag

- **Suspicious performances** — e.g. trust score below threshold.
- **Impossible pitch curves** — e.g. zero variance, step-function pitch.
- **Latency patterns** — e.g. no jitter, always same delay (pre-recorded).
- **Audio fingerprint match** — same or near-same as original track or prior session.

### 8.4 Pipeline

1. **Ingest**: same events as analytics (performance_start, note_result, performance_summary) + optional **audio hash** or features.
2. **Rules**: e.g. “pitch_error_std < 1 cent” → flag; “same audio_hash in 2 sessions” → flag.
3. **ML model**: train on known good/bad (e.g. human vs synthetic); output **trust score** per performance.
4. **Action**: auto-flag for review, cap leaderboard, or invalidate match; no automatic ban without review in v1.

---

## 9. Data Flow (End-to-End)

### 9.1 Ranked 1v1 example

1. **Auth** → player has JWT + refresh; device bound.
2. **Matchmaking** → queue with MMR, region, song prefs → match found → **game session** created.
3. **Join session** → WebSocket to game server; get room_id, round config (song_id, difficulty, countdown).
4. **Round start** → clients play; **audio streamed or chunked to backend** (or client sends feature vectors if you trust them less for anti-cheat).
5. **Scoring service**:
   - Receives audio (or features) + song_id + difficulty.
   - Runs pitch/timing/stability pipeline.
   - Writes **note_result** and **performance_summary** events; computes **final score**.
   - Returns score to game session (not to client as authority).
6. **Game session** → aggregates both players’ scores (from scoring service), applies any normalization, updates **MMR**, writes **match result** to DB, pushes result to both clients.
7. **Analytics** → all events already in event bus → analytics DB and anti-cheat consume.

### 9.2 What client sends vs what server computes

| Client sends | Server computes |
|--------------|-----------------|
| Raw audio (or encoded chunks) **or** pitch/timing features (if you accept higher risk) | Final pitch/timing/stability metrics |
| Session token, device id | Score, rank change, match result |
| Calibration data (optional) | Calibration validation and storage |

---

## 10. Suggested Repo / Service Layout

```
voxarena/
├── clients/           # Unity / Web / etc.
├── services/
│   ├── auth/          # Identity, device binding, JWT
│   ├── matchmaking/   # Queue, MMR lookup, session creation
│   ├── game-session/  # WebSocket server, round orchestration
│   ├── scoring/       # Audio pipeline, score computation, event emit
│   ├── anti-cheat/    # Rules + ML, trust score, flags
│   └── analytics/     # ETL, aggregates, dashboards (optional)
├── shared/
│   ├── events/        # Event schemas (e.g. Avro/JSON)
│   └── contracts/     # API contracts (OpenAPI)
├── infra/             # IaC (Terraform/Pulumi), k8s, queues
└── docs/
    └── ARCHITECTURE.md  # This file
```

---

## 11. Phasing (MVP → Full) — 4–6 week build

| Phase | Timeline | Delivered |
|-------|----------|-----------|
| **Phase 1** | ~2 weeks | Single song; pitch + timing scoring; local leaderboard. |
| **Phase 2** | ~2 weeks | AI bot opponent (Solo vs Bot); ranked ladder; voice quality stats (stability, dynamics, transitions). |
| **Phase 3** | ~2 weeks | Live PvP (1v1); anti-cheat (fingerprint, flags); tournaments (brackets). |

Later: Battle Royale, Team Duets, full ML anti-cheat, prize pools.

---

## 12. Summary

- **Performance analytics**: rich, event-based metrics (pitch, timing, stability, etc.) stored per note/phrase/song; power progression, matchmaking, and fairness.
- **Matchmaking**: MMR + region + song preference; same song/difficulty in ranked; MMR updates use normalized/expected score.
- **Fairness**: server-only scoring, per-song normalization, device calibration, no pay-to-win in ranked.
- **Anti-cheat**: server authority, signed sessions, event + optional audio pipeline, rules + ML, trust score and review.

This is the **real system stack** for **VoxArena**: not just pitch scoring, but a full competitive platform with analytics, matchmaking, fairness, and anti-cheat designed in from the start.
