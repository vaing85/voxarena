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
- `src/lib/socket.ts` — Socket.IO connection (handshake auth, reconnect, polling fallback).
- `src/lib/matchMachine.ts` — pure match state machine (unit-tested), driven by socket/REST events.
- `src/App.tsx` — solo loop: register → pick song → record → real 5-layer score → leaderboard.
- `src/LivePvp.tsx` — live ranked: matchmaking → synced countdown → sing → opponent progress → result.

## Live PvP flow

Find match (`/matchmaking/ranked/join`, polling `pending` while queued) → connect
the socket and `match:join` → on both present, a synced `match:start` countdown →
sing and submit via `/performances/audio` (mode `ranked_pvp` + `matchId`) →
authoritative `match:result` pushed to the room. The active `matchId` is kept in
`localStorage`, so a reload/disconnect re-joins and the server replays
`match:state` to resume (or show the result). Needs `REDIS_URL` on the API for
matchmaking.

## Status

Done: solo scoring loop + live PvP UI. **Next:** Stripe checkout, Supabase login,
PWA service worker (offline).
