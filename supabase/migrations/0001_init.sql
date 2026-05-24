-- VoxArena initial schema (Phase 0)
-- Voice models compete in blind A/B battles; crowd votes drive an Elo ranking.

create extension if not exists "pgcrypto";

-- Registered voice models (one row per competitor voice).
create table if not exists models (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  display_name      text not null,
  provider          text not null,
  provider_model_id text not null,
  description       text,
  is_active         boolean not null default true,
  -- Running Elo. Source of truth for vote events is the votes table; these
  -- columns are maintained incrementally for fast leaderboard reads.
  rating            double precision not null default 1000,
  wins              integer not null default 0,
  losses            integer not null default 0,
  ties              integer not null default 0,
  created_at        timestamptz not null default now()
);

-- Prompts (scripts) read aloud by both models in a battle.
create table if not exists prompts (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  category   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- A single blind comparison instance.
create table if not exists battles (
  id          uuid primary key default gen_random_uuid(),
  prompt_id   uuid not null references prompts(id),
  model_a_id  uuid not null references models(id),
  model_b_id  uuid not null references models(id),
  audio_a_url text,
  audio_b_url text,
  status      text not null default 'pending'
              check (status in ('pending', 'ready', 'voted')),
  voter_session text,
  created_at  timestamptz not null default now(),
  constraint distinct_models check (model_a_id <> model_b_id)
);

-- One vote per battle.
create table if not exists votes (
  id            uuid primary key default gen_random_uuid(),
  battle_id     uuid not null unique references battles(id),
  choice        text not null check (choice in ('a', 'b', 'tie', 'both_bad')),
  voter_session text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_battles_status on battles(status);
create index if not exists idx_models_rating on models(rating desc) where is_active;

-- NOTE: Row Level Security policies are intentionally deferred to the
-- hardening phase (Phase 4). Until then, do not connect a production project.
