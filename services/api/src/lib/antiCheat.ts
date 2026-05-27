/**
 * Anti-cheat detectors. Pure functions over performance events so the rules
 * are unit-testable; the consumer feeds events through them and queues any
 * resulting flags for human review (no auto-actions).
 */
import { weightedTotal } from "./scoring.js";

export type Severity = "low" | "medium" | "high";

export type FlagCandidate = {
  reason: "score_mismatch" | "suspicious_perfect" | "high_velocity";
  severity: Severity;
  details: Record<string, unknown>;
};

export type PerformanceLike = {
  scorePitch: number | null;
  scoreTiming: number | null;
  scoreStability: number | null;
  scoreDynamics: number | null;
  scoreTransitions: number | null;
  scoreTotal: number | null;
};

// Tolerance over the recomputed weighted total — covers per-layer rounding.
const TOTAL_TOLERANCE = 1.5;

export const VELOCITY_WINDOW_MS = 60_000;
export const VELOCITY_THRESHOLD = 10; // > this many submissions in the window

function allLayers(p: PerformanceLike): number[] | null {
  const layers = [
    p.scorePitch,
    p.scoreTiming,
    p.scoreStability,
    p.scoreDynamics,
    p.scoreTransitions,
  ];
  return layers.every((v): v is number => typeof v === "number") ? layers : null;
}

/**
 * Inspect a performance for cheat signals.
 * @param recentInWindow how many performances this player submitted in the
 *        velocity window (including this one), computed by the caller.
 */
export function analyzePerformance(
  p: PerformanceLike,
  recentInWindow = 0
): FlagCandidate[] {
  const flags: FlagCandidate[] = [];
  const layers = allLayers(p);

  // The stored total must match the server's weighted formula — a mismatch
  // means a fabricated/edited total (the JSON submit path trusts client scores).
  if (layers && typeof p.scoreTotal === "number") {
    const expected = weightedTotal({
      scorePitch: layers[0],
      scoreTiming: layers[1],
      scoreStability: layers[2],
      scoreDynamics: layers[3],
      scoreTransitions: layers[4],
    });
    if (Math.abs(expected - p.scoreTotal) > TOTAL_TOLERANCE) {
      flags.push({
        reason: "score_mismatch",
        severity: "high",
        details: { expected, stored: p.scoreTotal },
      });
    }
  }

  // A flawless run on every layer is rare enough to warrant a look.
  if (layers && p.scoreTotal === 100 && layers.every((v) => v === 100)) {
    flags.push({ reason: "suspicious_perfect", severity: "low", details: {} });
  }

  if (recentInWindow > VELOCITY_THRESHOLD) {
    flags.push({
      reason: "high_velocity",
      severity: "medium",
      details: { recentInWindow, windowMs: VELOCITY_WINDOW_MS },
    });
  }

  return flags;
}

/** Per-player sliding-window submission counter (in-process). */
export class VelocityTracker {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly windowMs: number = VELOCITY_WINDOW_MS) {}

  /** Record a submission at `nowMs` and return the count within the window. */
  record(playerId: string, nowMs: number = Date.now()): number {
    const cutoff = nowMs - this.windowMs;
    const kept = (this.hits.get(playerId) ?? []).filter((t) => t >= cutoff);
    kept.push(nowMs);
    this.hits.set(playerId, kept);
    return kept.length;
  }
}
