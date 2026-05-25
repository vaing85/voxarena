# VoxArena — Infra

- **docker-compose.yml** — Local **PostgreSQL** + **Redis** (matches Supabase Postgres + Railway Redis patterns). Run: `docker compose up -d` from this folder.
- **Railway** — Host the API (`services/api`); see [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
- **Supabase** — Managed Postgres + Auth + Storage; connection string in `DATABASE_URL`.
- **terraform** / **pulumi** — (Later) Full cloud provisioning for staging/production.

You can develop with Docker Postgres locally or point `DATABASE_URL` at a Supabase project.
