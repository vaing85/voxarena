import { describe, it, expect } from "vitest";
import { computeStubScores } from "./stubScore.js";
import { weightedTotal } from "./scoring.js";

const LAYER_KEYS = [
  "scorePitch",
  "scoreTiming",
  "scoreStability",
  "scoreDynamics",
  "scoreTransitions",
] as const;

describe("computeStubScores", () => {
  it("is deterministic for a given seed", () => {
    expect(computeStubScores("player:song:123")).toEqual(
      computeStubScores("player:song:123")
    );
  });

  it("produces different output for different seeds", () => {
    expect(computeStubScores("seed-a")).not.toEqual(computeStubScores("seed-b"));
  });

  it("keeps every layer within the stub range [60, 100]", () => {
    for (const seed of ["a", "longer-seed-value", "12345", ""]) {
      const s = computeStubScores(seed);
      for (const key of LAYER_KEYS) {
        expect(s[key]).toBeGreaterThanOrEqual(60);
        expect(s[key]).toBeLessThanOrEqual(100);
      }
    }
  });

  it("computes scoreTotal as the weighted total of its layers", () => {
    const s = computeStubScores("consistency-check");
    expect(s.scoreTotal).toBe(
      weightedTotal({
        scorePitch: s.scorePitch,
        scoreTiming: s.scoreTiming,
        scoreStability: s.scoreStability,
        scoreDynamics: s.scoreDynamics,
        scoreTransitions: s.scoreTransitions,
      })
    );
  });
});
