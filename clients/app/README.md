# VoxArena — Web app

The shipping web client (React + TypeScript + Vite, PWA-ready). Cross-platform
by design: installable on desktop/mobile from the browser, reuses the
server-authoritative API. The `../web` folder is the throwaway dev harness; this
is the real client.

## Run

```bash
cd clients/app
npm install
cp .env.example .env      # point VITE_API_URL at your API (default :3000)
npm run dev               # http://localhost:5173
```

Start the API too (`cd services/api && npm run dev`, with `AUTH_DEV_BYPASS=true`
for the dev identity flow). Recording needs HTTPS or `localhost` for mic access,
and `PITCH_SERVICE_URL` set on the API for real scoring (otherwise audio scoring
returns 503).

```bash
npm run build       # tsc --noEmit + vite build
npm run typecheck
npm test            # vitest (pure modules: WAV encoder, API client)
```

## Layout

- `src/lib/api.ts` — typed REST client.
- `src/lib/audio.ts` — mic capture + in-browser WAV encoding (the pitch service reads WAV).
- `src/lib/session.ts` — identity + active-match persistence (for reload/reconnect resume).
- `src/App.tsx` — solo loop: register → pick song → record → real 5-layer score → leaderboard.

## Status

Slice 1: the solo record→score→leaderboard loop. **Next:** live PvP UI over the
Socket.IO layer (`shared/contracts/README.md`) — join, synced countdown,
opponent progress, result — with on-device match persistence + idempotent
resubmit on reconnect.
