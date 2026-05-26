# VoxArena — Shared

Shared contracts and schemas used by services and clients.

- **contracts** — `openapi.yaml`: the OpenAPI 3 source of truth for the REST API.
- **events** — JSON-Schema event payloads (`performance.recorded`, `match.completed`, `entitlement.granted`) for analytics and anti-cheat.

Both are validated by `services/api/src/contracts.test.ts`. See each subfolder's README.
