import { describe, it, expect } from "vitest";
import { generateBotScores, listBotPresets, type BotPreset } from "./bots.js";

const LAYER_KEYS = [
  "scorePitch",
  "scoreTiming",
  "scoreStability",
  "scoreDynamics",
  "scoreTransitions",
] as const;

describe("listBotPresets", () => {
  it("returns the four known presets", () => {
    expect(listBotPresets().sort()).toEqual(["metro", "pro", "rookie", "soul"]);
  });
});

describe("generateBotScores", () => {
  it("is deterministic for the same preset/seed/difficulty", () => {
    expect(generateBotScores("pro", "seed-1", "medium")).toEqual(
      generateBotScores("pro", "seed-1", "medium")
    );
  });

  it("clamps every layer into 40–99 with a finite total", () => {
    for (const preset of listBotPresets()) {
      for (const difficulty of ["easy", "medium", "hard"]) {
        const s = generateBotScores(preset as BotPreset, `s:${difficulty}`, difficulty);
        for (const k of LAYER_KEYS) {
          expect(s[k]).toBeGreaterThanOrEqual(40);
          expect(s[k]).toBeLessThanOrEqual(99);
        }
        expect(Number.isFinite(s.scoreTotal)).toBe(true);
      }
    }
  });
});
