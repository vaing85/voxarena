import { describe, it, expect } from "vitest";
import { generateBotScores, listBotPresets, type BotPreset } from "./bots.js";
import { weightedTotal } from "./scoring.js";

const LAYER_KEYS = [
  "scorePitch",
  "scoreTiming",
  "scoreStability",
  "scoreDynamics",
  "scoreTransitions",
] as const;

describe("listBotPresets", () => {
  it("exposes the four personalities", () => {
    expect(listBotPresets().sort()).toEqual(
      ["metro", "pro", "rookie", "soul"].sort()
    );
  });
});

describe("generateBotScores", () => {
  const presets = listBotPresets();

  it.each(presets)("is deterministic for preset %s", (preset) => {
    expect(generateBotScores(preset, "seed-1", "medium")).toEqual(
      generateBotScores(preset, "seed-1", "medium")
    );
  });

  it.each(presets)("clamps every layer to [40, 99] for preset %s", (preset) => {
    for (const seed of ["a", "b", "c", "deterministic-seed", "12345"]) {
      const s = generateBotScores(preset, seed, "hard");
      for (const key of LAYER_KEYS) {
        expect(s[key]).toBeGreaterThanOrEqual(40);
        expect(s[key]).toBeLessThanOrEqual(99);
      }
    }
  });

  it("computes scoreTotal as the weighted total of its layers", () => {
    const s = generateBotScores("pro", "total-check", "medium");
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

  it("treats an unknown difficulty as the easy factor", () => {
    // difficultyFactor falls back to 0.92 for anything that is not hard/medium.
    const unknown = generateBotScores("pro", "diff-seed", "banana");
    const easy = generateBotScores("pro", "diff-seed", "easy");
    expect(unknown).toEqual(easy);
  });

  it("scales scores up on harder difficulty for the same seed", () => {
    const easy = generateBotScores("rookie", "scale-seed", "easy");
    const hard = generateBotScores("rookie", "scale-seed", "hard");
    expect(hard.scoreTotal).toBeGreaterThanOrEqual(easy.scoreTotal);
  });
});
