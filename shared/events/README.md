# Event schemas

Domain event payloads (JSON Schema, draft 2020-12) for the analytics and
anti-cheat pipeline. Each event shares an envelope: `event` (the name), an
integer `version`, and an ISO `occurredAt` timestamp.

| File | Emitted when |
|------|--------------|
| `performance.recorded.json` | A performance is stored (`POST /performances`, solo-vs-bot). |
| `match.completed.json` | A match is finalized and MMR applied. |
| `entitlement.granted.json` | A player gains a pack (purchase or grant). |

**Emitter:** the API publishes these events from `services/api/src/lib/events.ts`.
When `REDIS_URL` is set they're appended to the Redis Stream `voxarena:events`
(`XADD`, fields `event` + JSON `data`); otherwise they're logged in dev. Emission
is fire-and-forget and never fails the request. A consumer (analytics /
anti-cheat) reads the stream — still TODO.

`services/api/src/contracts.test.ts` validates each schema's envelope and that
its `event` const matches the filename; `events.test.ts` checks the emitter's
output conforms to these schemas (required keys + `additionalProperties: false`).

Future events (per [ARCHITECTURE](../../docs/ARCHITECTURE.md)): `note_result`,
`phrase_result`, finer-grained signals for anti-cheat.
