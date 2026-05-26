# API contracts

REST and (later) Socket.IO API contracts used by services and clients.

## `openapi.yaml` — REST contract

OpenAPI 3 spec for the VoxArena API. It is the single source of truth for the
HTTP surface (paths, request/response shapes, auth schemes, error codes).

- **View it:** paste into [editor.swagger.io](https://editor.swagger.io) or run
  `npx @redocly/cli preview-docs shared/contracts/openapi.yaml`.
- **Generate a typed client/SDK:** e.g. `npx openapi-typescript shared/contracts/openapi.yaml -o client-types.ts`.
- **Kept honest by tests:** `services/api/src/contracts.test.ts` parses the spec
  and asserts every implemented route is documented and that security schemes resolve.

Auth schemes: `bearerAuth` (Supabase access token) and `devPlayerId`
(`x-player-id` header, local dev only). Reads are public; writes require auth.

## Socket.IO — live PvP

Realtime session coordination (`services/api/src/realtime/liveMatch.ts`). The
socket layer is **not** score-authoritative: players submit scored performances
via REST, and the authoritative result is pushed here when the ranked match
finalizes. Identity is passed in the handshake: `auth: { token }` (Supabase) or
`auth: { playerId }` (dev bypass).

**Client → server**

| Event | Payload | Notes |
|-------|---------|-------|
| `match:join` | `{ matchId }` | Join the room; must be a participant of a pending match. |
| `match:progress` | `{ score }` | Live, non-authoritative; relayed to the opponent. |

**Server → client**

| Event | Payload |
|-------|---------|
| `match:presence` | `{ matchId, players: string[] }` |
| `match:start` | `{ matchId, startsAt }` (emitted once both players are present; `startsAt` is a synchronized countdown timestamp) |
| `opponent:progress` | `{ playerId, score }` |
| `match:result` | `{ matchId, winnerId, player1Id, player2Id, player1Score, player2Score, mmr }` |
| `match:error` | `{ error }` |
