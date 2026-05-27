/**
 * Reads the `voxarena:events` Redis Stream and runs anti-cheat detectors,
 * queueing flags for human review. Runs in-process, gated by env
 * (ANTICHEAT_CONSUMER=true + REDIS_URL). Single-instance only — a second
 * instance would need distinct consumer names within the group.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { getRedis } from "./redis.js";
import { EVENTS_STREAM_KEY } from "./events.js";
import { analyzePerformance, VelocityTracker, type PerformanceLike } from "./antiCheat.js";

const GROUP = "anticheat";
const CONSUMER = "anticheat-1";

/** Run detectors for one event and persist any flags. Exposed for testing. */
export async function processEvent(
  prisma: PrismaClient,
  raw: unknown,
  tracker: VelocityTracker,
  nowMs: number = Date.now()
): Promise<number> {
  let evt: Record<string, unknown>;
  try {
    evt = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
  } catch {
    return 0;
  }
  if (evt.event !== "performance.recorded") return 0;

  const playerId = String(evt.playerId);
  const recent = tracker.record(playerId, nowMs);
  const candidates = analyzePerformance(evt as unknown as PerformanceLike, recent);
  if (candidates.length === 0) return 0;

  await prisma.cheatFlag.createMany({
    data: candidates.map((c) => ({
      playerId,
      performanceId: typeof evt.performanceId === "string" ? evt.performanceId : null,
      reason: c.reason,
      severity: c.severity,
      details: c.details as Prisma.InputJsonValue,
    })),
  });
  return candidates.length;
}

export function isConsumerEnabled(): boolean {
  return process.env.ANTICHEAT_CONSUMER === "true" && Boolean(process.env.REDIS_URL);
}

/** Start the background consumer loop. No-op unless enabled. Returns a stop fn. */
export function startEventConsumer(prisma: PrismaClient): () => void {
  if (!isConsumerEnabled()) return () => {};
  const redis = getRedis();
  if (!redis) return () => {};

  const tracker = new VelocityTracker();
  let stopped = false;

  (async () => {
    // Create the consumer group (idempotent; ignore BUSYGROUP).
    try {
      await redis.xgroup("CREATE", EVENTS_STREAM_KEY, GROUP, "$", "MKSTREAM");
    } catch (e) {
      if (!String(e).includes("BUSYGROUP")) {
        console.error("[anticheat] group create failed:", String(e));
      }
    }
    console.log("[anticheat] consumer started on", EVENTS_STREAM_KEY);

    while (!stopped) {
      try {
        const res = (await redis.xreadgroup(
          "GROUP",
          GROUP,
          CONSUMER,
          "COUNT",
          10,
          "BLOCK",
          5000,
          "STREAMS",
          EVENTS_STREAM_KEY,
          ">"
        )) as [string, [string, string[]][]][] | null;
        if (!res) continue;
        for (const [, entries] of res) {
          for (const [id, fields] of entries) {
            const dataIdx = fields.indexOf("data");
            const raw = dataIdx >= 0 ? fields[dataIdx + 1] : undefined;
            try {
              await processEvent(prisma, raw, tracker);
            } catch (e) {
              console.error("[anticheat] process failed:", String(e));
            }
            await redis.xack(EVENTS_STREAM_KEY, GROUP, id);
          }
        }
      } catch (e) {
        if (!stopped) console.error("[anticheat] read loop error:", String(e));
      }
    }
  })();

  return () => {
    stopped = true;
  };
}
