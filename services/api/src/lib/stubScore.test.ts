import { describe, it, expect } from "vitest";
import { computeStubScores } from "./stubScore.js";

const LAYER_KEYS = [
  "scorePitch",
  "scoreTiming",
  "scoreStability",
  "scoreDynamics",
  "scoreTransitions",
] as const;

describe("computeStubScores", () => {
  it("is deterministic for a given seed", () => {
    expect(computeStubScores("player:song:1")).toEqual(
      computeStubScores("player:song:1")
    );
  });

  it("produces each layer in the 60–100 range", () => {
    const s = computeStubScores("abc");
    for (const k of LAYER_KEYS) {
      expect(s[k]).toBeGreaterThanOrEqual(60);
      expect(s[k]).toBeLessThanOrEqual(100);
    }
  });

  it("returns a finite weighted total", () => {
    const s = computeStubScores("xyz");
    expect(Number.isFinite(s.scoreTotal)).toBe(true);
    expect(s.scoreTotal).toBeGreaterThanOrEqual(60);
    expect(s.scoreTotal).toBeLessThanOrEqual(100);
  });
});
