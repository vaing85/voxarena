"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeStubScores = computeStubScores;
const scoring_js_1 = require("./scoring.js");
/**
 * Deterministic stub layer scores when the client sends none (dev / Phase 1).
 */
function computeStubScores(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    const u = (n) => {
        const x = Math.abs(Math.sin(h + n) * 10000) % 1;
        return Math.round(60 + x * 40);
    };
    const layers = {
        scorePitch: u(1),
        scoreTiming: u(2),
        scoreStability: u(3),
        scoreDynamics: u(4),
        scoreTransitions: u(5),
    };
    return (0, scoring_js_1.layersWithTotal)(layers);
}
