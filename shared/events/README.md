# Event schemas

Domain event payloads (JSON Schema, draft 2020-12) for the analytics and
anti-cheat pipeline. Each event shares an envelope: `event` (the name), an
integer `version`, and an ISO `occurredAt` timestamp.

| File | Emitted when |
|------|--------------|
| `performance.recorded.json` | A performance is stored (`POST /performances`, solo-vs-bot). |
| `match.completed.json` | A match is finalized and MMR applied. |
| `entitlement.granted.json` | A player gains a pack (purchase or grant). |

These define the **contract**; wiring an emitter (e.g. to Redis/queue) is a
follow-up. `services/api/src/contracts.test.ts` validates each schema's
envelope and that its `event` const matches the filename.

Future events (per [ARCHITECTURE](../../docs/ARCHITECTURE.md)): `note_result`,
`phrase_result`, finer-grained signals for anti-cheat.
