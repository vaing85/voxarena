import { describe, it, expect } from "vitest";
import { SCORE_WEIGHTS, weightedTotal, layersWithTotal } from "./scoring.js";

const FULL = {
  scorePitch: 100,
  scoreTiming: 100,
  scoreStability: 100,
  scoreDynamics: 100,
  scoreTransitions: 100,
};

describe("SCORE_WEIGHTS", () => {
  it("sums to 1", () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("weightedTotal", () => {
  it("returns 100 when every layer is 100", () => {
    expect(weightedTotal(FULL)).toBe(100);
  });

  it("applies the pitch weight when only pitch scores", () => {
    expect(
      weightedTotal({
        scorePitch: 100,
        scoreTiming: 0,
        scoreStability: 0,
        scoreDynamics: 0,
        scoreTransitions: 0,
      })
    ).toBe(40);
  });
});

describe("layersWithTotal", () => {
  it("keeps the layers and appends a matching total", () => {
    const out = layersWithTotal(FULL);
    expect(out.scorePitch).toBe(100);
    expect(out.scoreTotal).toBe(weightedTotal(FULL));
  });
});
