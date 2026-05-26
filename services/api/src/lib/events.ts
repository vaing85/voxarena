/**
 * Domain event emitter for the analytics / anti-cheat pipeline.
 *
 * Envelopes match the JSON Schemas in `shared/events`. Events are appended to a
 * Redis Stream when REDIS_URL is set; otherwise they're logged in dev (and
 * silently dropped under test). Emission is fire-and-forget and never throws
 * into the request path — a failed publish must not fail the user's request.
 */
import { getRedis } from "./redis.js";

export const EVENTS_STREAM_KEY = "voxarena:events";

type Json = Record<string, unknown>;

async function publish(evt: Json): Promise<void> {
  try {
    const redis = getRedis();
    if (redis) {
      await redis.xadd(
        EVENTS_STREAM_KEY,
        "*",
        "event",
        String(evt.event),
        "data",
        JSON.stringify(evt)
      );
      return;
    }
    if (!process.env.VITEST) {
      console.log(`[event] ${JSON.stringify(evt)}`);
    }
  } catch (e) {
    if (!process.env.VITEST) {
      console.error(`[event] publish failed (${String(evt.event)}): ${String(e)}`);
    }
  }
}

const now = () => new Date().toISOString();

export type PerformanceEvent = {
  id: string;
  playerId: string;
  songId: string;
  matchId?: string | null;
  mode: string;
  scorePitch?: number | null;
  scoreTiming?: number | null;
  scoreStability?: number | null;
  scoreDynamics?: number | null;
  scoreTransitions?: number | null;
  scoreTotal?: number | null;
};

export function emitPerformanceRecorded(p: PerformanceEvent): Promise<void> {
  return publish({
    event: "performance.recorded",
    version: 1,
    occurredAt: now(),
    performanceId: p.id,
    playerId: p.playerId,
    songId: p.songId,
    matchId: p.matchId ?? null,
    mode: p.mode,
    scorePitch: p.scorePitch ?? null,
    scoreTiming: p.scoreTiming ?? null,
    scoreStability: p.scoreStability ?? null,
    scoreDynamics: p.scoreDynamics ?? null,
    scoreTransitions: p.scoreTransitions ?? null,
    scoreTotal: p.scoreTotal ?? null,
  });
}

export type MatchEvent = {
  matchId: string;
  songId: string;
  mode: string;
  player1Id: string;
  player2Id: string;
  winnerId: string;
  player1Score?: number | null;
  player2Score?: number | null;
  mmr?: {
    player1Id: string;
    player2Id: string;
    newMmr1: number;
    newMmr2: number;
  } | null;
};

export function emitMatchCompleted(m: MatchEvent): Promise<void> {
  return publish({
    event: "match.completed",
    version: 1,
    occurredAt: now(),
    matchId: m.matchId,
    songId: m.songId,
    mode: m.mode,
    player1Id: m.player1Id,
    player2Id: m.player2Id,
    winnerId: m.winnerId,
    player1Score: m.player1Score ?? null,
    player2Score: m.player2Score ?? null,
    mmr: m.mmr ?? null,
  });
}

export type EntitlementEvent = {
  playerId: string;
  packId: string;
  source: "purchase" | "grant";
  stripeSessionId?: string | null;
};

export function emitEntitlementGranted(e: EntitlementEvent): Promise<void> {
  return publish({
    event: "entitlement.granted",
    version: 1,
    occurredAt: now(),
    playerId: e.playerId,
    packId: e.packId,
    source: e.source,
    stripeSessionId: e.stripeSessionId ?? null,
  });
}
