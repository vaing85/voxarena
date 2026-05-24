# VoxArena

Blind A/B battles for voice AI models, ranked by the crowd — like LMArena, but
for voice. Two anonymous models speak the same prompt; you vote on which sounds
better; votes drive a public Elo leaderboard.

> **Status:** Phase 0 (foundations). See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack
Next.js (App Router, TypeScript) · Supabase (Postgres/auth/storage) · Tailwind CSS

## Getting started
```bash
npm install
cp .env.example .env.local   # fill in Supabase + provider keys
npm run dev                  # http://localhost:3000
```
Health check: `GET /api/health` → `{ "status": "ok" }`.

## Database
SQL migrations live in [`supabase/migrations`](supabase/migrations). Apply them
to your Supabase project (CLI `supabase db push`, the dashboard SQL editor, or
the Supabase MCP `apply_migration` tool).

## Layout
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full breakdown.
