"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBotScores = generateBotScores;
exports.listBotPresets = listBotPresets;
const scoring_js_1 = require("./scoring.js");
const PRESETS = {
    rookie: {
        pitchBase: 62,
        pitchVariance: 22,
        timingJitter: 18,
        stabilityNoise: 20,
        skipChance: 0.12,
    },
    pro: {
        pitchBase: 88,
        pitchVariance: 8,
        timingJitter: 6,
        stabilityNoise: 8,
        skipChance: 0.02,
    },
    metro: {
        pitchBase: 82,
        pitchVariance: 4,
        timingJitter: 4,
        stabilityNoise: 5,
        skipChance: 0.01,
    },
    soul: {
        pitchBase: 78,
        pitchVariance: 14,
        timingJitter: 10,
        stabilityNoise: 18,
        skipChance: 0.04,
    },
};
/** Deterministic pseudo-random 0..1 from seed string. */
function hash01(seed, salt) {
    let h = salt;
    for (let i = 0; i < seed.length; i++) {
        h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    return (Math.abs(Math.sin(h) * 10000) % 1 + 1) % 1;
}
function difficultyFactor(difficulty) {
    const d = difficulty.toLowerCase();
    if (d === "hard")
        return 1.08;
    if (d === "medium")
        return 1.0;
    return 0.92;
}
/**
 * Simulated bot layer scores (Layer A–C) for solo_vs_bot.
 * Not ML — personality + deterministic noise from seed.
 */
function generateBotScores(preset, seed, songDifficulty) {
    const p = PRESETS[preset];
    const df = difficultyFactor(songDifficulty);
    const r = (n) => hash01(seed, n);
    const skip = r(99) < p.skipChance;
    let scorePitch = Math.round((p.pitchBase + (r(1) - 0.5) * 2 * p.pitchVariance) * df);
    if (skip)
        scorePitch = Math.max(40, scorePitch - 25);
    let scoreTiming = Math.round((72 + (r(2) - 0.5) * p.timingJitter * 2) * df);
    let scoreStability = Math.round((70 + (r(3) - 0.5) * p.stabilityNoise * 2) * df);
    let scoreDynamics = Math.round((65 + r(4) * 30) * df);
    let scoreTransitions = Math.round((68 + r(5) * 28) * df);
    scorePitch = clamp(scorePitch, 40, 99);
    scoreTiming = clamp(scoreTiming, 40, 99);
    scoreStability = clamp(scoreStability, 40, 99);
    scoreDynamics = clamp(scoreDynamics, 40, 99);
    scoreTransitions = clamp(scoreTransitions, 40, 99);
    const layers = {
        scorePitch,
        scoreTiming,
        scoreStability,
        scoreDynamics,
        scoreTransitions,
    };
    return (0, scoring_js_1.layersWithTotal)(layers);
}
function listBotPresets() {
    return Object.keys(PRESETS);
}
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
