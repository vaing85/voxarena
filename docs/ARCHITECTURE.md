# Architecture

## Stack
- **Next.js** (App Router, TypeScript) — UI + API routes.
- **Supabase** — Postgres, auth, storage, realtime.
- **Tailwind CSS** — styling.

## Layout
```
src/
  app/                 # routes (App Router)
    api/health/        # health check
  lib/
    supabase/          # browser + server Supabase clients
    providers/         # voice provider adapter layer
supabase/
  migrations/          # SQL schema migrations
docs/                  # roadmap + architecture
```

## Provider adapter layer
`src/lib/providers` defines a single `VoiceProvider` interface (`types.ts`) and
a `registry.ts` for resolving providers by id. The battle engine depends only
on the interface, never on a specific vendor SDK — adding a provider means
writing one adapter and registering it. Concrete adapters arrive in Phase 1.

## Data model (see `supabase/migrations/0001_init.sql`)
- **models** — competitor voices; carries running Elo + win/loss/tie counts.
- **prompts** — scripts spoken in battles.
- **battles** — one blind A/B instance (prompt + two models + audio URLs).
- **votes** — one vote per battle (`a` / `b` / `tie` / `both_bad`).

Votes are the source of truth; the rating columns on `models` are maintained
incrementally for fast leaderboard reads.

## Battle flow (target, Phase 2–3)
1. Pick an active prompt; sample two distinct active models.
2. Synthesize audio for each via its provider; store URLs on the battle.
3. Serve blind (randomized A/B position) until the user votes.
4. On vote: reveal identities, update Elo, persist the vote.
