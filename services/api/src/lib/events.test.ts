import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("./redis.js", () => ({ getRedis: vi.fn() }));
import { getRedis } from "./redis.js";
import {
  EVENTS_STREAM_KEY,
  emitPerformanceRecorded,
  emitMatchCompleted,
  emitEntitlementGranted,
  emitCosmeticGranted,
} from "./events.js";

const SHARED = path.resolve(process.cwd(), "..", "..", "shared", "events");

function loadSchema(name: string) {
  return JSON.parse(readFileSync(path.join(SHARED, `${name}.json`), "utf8"));
}

// Validate an emitted envelope against the shared JSON Schema: required keys
// present, and no keys outside `properties` (schemas set additionalProperties:false).
function assertMatchesSchema(envelope: Record<string, unknown>, schemaName: string) {
  const schema = loadSchema(schemaName);
  for (const req of schema.required as string[]) {
    expect(envelope, `missing required "${req}"`).toHaveProperty(req);
  }
  const allowed = new Set(Object.keys(schema.properties));
  for (const key of Object.keys(envelope)) {
    expect(allowed.has(key), `unexpected key "${key}" not in schema`).toBe(true);
  }
  expect(envelope.event).toBe(schemaName);
}

let xadd: ReturnType<typeof vi.fn>;

function lastEnvelope(): Record<string, unknown> {
  // publish() calls: xadd(KEY, "*", "event", name, "data", json)
  const args = xadd.mock.calls.at(-1)!;
  expect(args[0]).toBe(EVENTS_STREAM_KEY);
  return JSON.parse(args[5] as string);
}

beforeEach(() => {
  xadd = vi.fn().mockResolvedValue("1-0");
  vi.mocked(getRedis).mockReturnValue({ xadd } as never);
});

describe("event emitter", () => {
  it("emits a schema-valid performance.recorded", async () => {
    await emitPerformanceRecorded({
      id: "perf-1",
      playerId: "player-1",
      songId: "song-1",
      mode: "ranked_pvp",
      matchId: "match-1",
      scorePitch: 90,
      scoreTotal: 88,
    });
    const env = lastEnvelope();
    assertMatchesSchema(env, "performance.recorded");
    expect(env.performanceId).toBe("perf-1");
    expect(env.matchId).toBe("match-1");
    expect(env.scoreTiming).toBeNull(); // omitted -> explicit null
    expect(env.version).toBe(1);
  });

  it("emits a schema-valid match.completed with mmr", async () => {
    await emitMatchCompleted({
      matchId: "match-1",
      songId: "song-1",
      mode: "ranked_pvp",
      player1Id: "a",
      player2Id: "b",
      winnerId: "a",
      player1Score: 91,
      player2Score: 80,
      mmr: { player1Id: "a", player2Id: "b", newMmr1: 1016, newMmr2: 984 },
    });
    assertMatchesSchema(lastEnvelope(), "match.completed");
  });

  it("emits a schema-valid entitlement.granted", async () => {
    await emitEntitlementGranted({
      playerId: "player-1",
      packId: "pack-1",
      source: "purchase",
      stripeSessionId: "cs_123",
    });
    const env = lastEnvelope();
    assertMatchesSchema(env, "entitlement.granted");
    expect(env.source).toBe("purchase");
  });

  it("emits a schema-valid cosmetic.granted", async () => {
    await emitCosmeticGranted({
      playerId: "player-1",
      cosmeticItemId: "cosmetic-1",
      source: "purchase",
      stripeSessionId: "cs_1",
    });
    const env = lastEnvelope();
    assertMatchesSchema(env, "cosmetic.granted");
    expect(env.cosmeticItemId).toBe("cosmetic-1");
  });

  it("never throws when Redis is unavailable", async () => {
    vi.mocked(getRedis).mockReturnValue(null);
    await expect(
      emitEntitlementGranted({ playerId: "p", packId: "k", source: "grant" })
    ).resolves.toBeUndefined();
  });

  it("never throws when the publish fails", async () => {
    xadd.mockRejectedValue(new Error("redis down"));
    await expect(
      emitMatchCompleted({
        matchId: "m",
        songId: "s",
        mode: "ranked_pvp",
        player1Id: "a",
        player2Id: "b",
        winnerId: "a",
      })
    ).resolves.toBeUndefined();
  });
});
