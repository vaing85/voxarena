# VoxArena — Prerequisites

What to install before development, and in what order. You can do **Phase 1 MVP** with **Node**, **PostgreSQL** (local or **Supabase**), and optionally **Redis**; add Python and a game engine when you need pitch ML and the client.

---

## Required for backend (Phase 1+)

| Prerequisite | Version | Purpose | How to verify |
|--------------|---------|---------|----------------|
| **Node.js** | 18+ (LTS) | API, matchmaking, game session, Prisma | `node -v` and `npm -v` |
| **npm** | 9+ | Package manager | `npm -v` |
| **PostgreSQL** | 14+ (or **Supabase** hosted) | Players, songs, performances, matches | `psql --version` or Supabase dashboard connection test |
| **Redis** | 7+ (optional Phase 1) | Matchmaking queues, session state | `redis-cli ping` → `PONG` |

**Install tips**

- **Node**: [nodejs.org](https://nodejs.org) or `nvm install 18`.
- **Postgres**: [Docker Compose](../infra/docker-compose.yml) (`postgres:16-alpine`) or [Supabase](https://supabase.com) (free tier) — copy `DATABASE_URL` from Project Settings → Database.
- **Redis**: [redis.io/download](https://redis.io/download), [Memurai](https://www.memurai.com/) on Windows, or Railway/Upstash in production.

---

## Required for pitch ML & anti-cheat (Phase 2+)

| Prerequisite | Version | Purpose | How to verify |
|--------------|---------|---------|----------------|
| **Python** | 3.10+ | Pitch (CREPE/PYIN), anti-cheat ML | `python --version` or `python3 --version` |
| **pip** | — | Python packages | `pip --version` |
| **PyTorch** | 2.x | CREPE / neural pitch; anti-cheat models | `python -c "import torch; print(torch.__version__)"` |

**Install tips**

- **Python**: [python.org](https://www.python.org/downloads/) or `pyenv`.
- **PyTorch**: [pytorch.org](https://pytorch.org/get-started/locally/) — pick your OS and CUDA/CPU.

---

## Required for the game client (when you build it)

| Prerequisite | Purpose |
|--------------|---------|
| **Unity** (2022 LTS+) or **Godot** (4.x) | Game client, UI, mic capture, WebRTC/Socket.IO client |

Install when you start the client; the backend and pitch service can be developed and tested without a full game client (e.g. with Postman or a small test harness).

---

## Optional but useful

| Prerequisite | Purpose |
|--------------|---------|
| **Docker & Docker Compose** | Run Postgres + Redis in one command ([infra/docker-compose.yml](../infra/docker-compose.yml)) |
| **Git** | Version control (you likely have this already) |

---

## Order of operations

1. **Now (before coding)**  
   - Install **Node.js** and **npm**.  
   - Run **Postgres + Redis** via Docker, or create a **Supabase** project and set `DATABASE_URL`.

2. **When you start the backend**  
   - Repo ready → `npm install` in `services/api` → copy `.env.example` to `.env` → `npx prisma generate` → `npx prisma db push` → run the API (see [GETTING_STARTED.md](GETTING_STARTED.md)).

3. **When you add server-side pitch**  
   - Install **Python 3.10+** and **PyTorch**; create a venv; add `requirements.txt` and run the pitch service.

4. **When you build the client**  
   - Install **Unity** or **Godot**; open the `clients/` project.

You don’t need Python or a game engine to get the repo structure and backend running — only Node and a Postgres `DATABASE_URL` (local or Supabase).
