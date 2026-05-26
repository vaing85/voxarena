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

## Socket.IO (later)

Add realtime event names + payload shapes here when live PvP lands.
