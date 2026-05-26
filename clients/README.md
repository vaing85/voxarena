# VoxArena — Clients

## `web/` — dev client (no build step)

A single static `index.html` (vanilla JS) that drives the full API loop:
register a player, list songs, submit a performance, play solo-vs-bot, and
view the leaderboard.

**Run it:** the API serves `clients/web` automatically when present. Start the
API (`cd services/api && npm run dev`) and open `http://localhost:3000/`.

- Uses the local **dev-bypass** auth flow: it stores the created player id and
  sends it as the `x-player-id` header on writes (set `AUTH_DEV_BYPASS=true` in
  `services/api/.env`).
- Override the served directory with `CLIENT_DIR`. The API skips serving it when
  the folder is absent (e.g. a `services/api`-only deploy), so production isn't affected.

This is a developer harness, not the shipping game client.

## Game clients (later)

- **Unity** — Add a Unity project here (e.g. `clients/unity/`) when you begin the client.
- **Godot** — Add a Godot project here (e.g. `clients/godot/`) when you begin the client.

Client responsibilities: mic capture, WebRTC or chunked upload to backend, Socket.IO for room sync, display-only feedback (server is score authority). See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).
