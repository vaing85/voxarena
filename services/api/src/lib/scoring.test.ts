import { describe, it, expect } from "vitest";
import { SCORE_WEIGHTS, weightedTotal, layersWithTotal } from "./scoring.js";

describe("SCORE_WEIGHTS", () => {
  it("sum to 1.0 (ARCHITECTURE §4.4)", () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("weightedTotal", () => {
  it("returns the same value when every layer is equal", () => {
    expect(
      weightedTotal({
        scorePitch: 100,
        scoreTiming: 100,
        scoreStability: 100,
        scoreDynamics: 100,
        scoreTransitions: 100,
      })
    ).toBe(100);
  });

  it("computes a known weighted mix", () => {
    // 80*.4 + 60*.25 + 40*.15 + 20*.1 + 0*.1 = 32 + 15 + 6 + 2 + 0 = 55
    expect(
      weightedTotal({
        scorePitch: 80,
        scoreTiming: 60,
        scoreStability: 40,
        scoreDynamics: 20,
        scoreTransitions: 0,
      })
    ).toBe(55);
  });

  it("returns an integer (rounded)", () => {
    const total = weightedTotal({
      scorePitch: 83,
      scoreTiming: 77,
      scoreStability: 61,
      scoreDynamics: 54,
      scoreTransitions: 49,
    });
    expect(Number.isInteger(total)).toBe(true);
  });

  it("weights pitch most heavily", () => {
    const base = {
      scorePitch: 50,
      scoreTiming: 50,
      scoreStability: 50,
      scoreDynamics: 50,
      scoreTransitions: 50,
    };
    const pitchBoost = weightedTotal({ ...base, scorePitch: 100 });
    const transitionsBoost = weightedTotal({ ...base, scoreTransitions: 100 });
    expect(pitchBoost).toBeGreaterThan(transitionsBoost);
  });
});

describe("layersWithTotal", () => {
  it("preserves the layers and appends scoreTotal", () => {
    const layers = {
      scorePitch: 90,
      scoreTiming: 80,
      scoreStability: 70,
      scoreDynamics: 60,
      scoreTransitions: 50,
    };
    const result = layersWithTotal(layers);
    expect(result).toMatchObject(layers);
    expect(result.scoreTotal).toBe(weightedTotal(layers));
  });
});
