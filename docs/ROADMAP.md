# VoxArena Roadmap

VoxArena is a **voice AI battle arena**: users hear two anonymous voice models
speak the same prompt, vote on which sounds better, and those votes drive a
public Elo leaderboard. (Think LMArena, but for voice.)

First comparison type: **TTS** (text → speech, same script both sides).

## Phases

| Phase | Goal | Deliverable | Status |
|------|------|-------------|--------|
| **0. Foundations** | Stack, scaffold, schema, CI | Running app shell + DB migration | ✅ in progress |
| **1. Provider layer** | 2–3 TTS providers behind one adapter | Generate audio from a prompt via any provider | ⬜ |
| **2. Battle MVP** | Blind A/B flow end-to-end | Prompt → 2 clips → vote recorded | ⬜ |
| **3. Ranking** | Elo scoring + leaderboard | Votes update rankings; leaderboard page | ⬜ |
| **4. Hardening** | Auth, RLS, rate limiting, audio caching/cost controls | Abuse-resistant, cost-bounded | ⬜ |
| **5. Polish** | Categories, filters, share links, analytics | Public-ready | ⬜ |

## Open decisions
- Which TTS providers to wire first (depends on available API keys).
- Audio storage: Supabase Storage vs. generate-on-demand + cache.
- Anonymous voting model and anti-abuse strategy (Phase 4).
