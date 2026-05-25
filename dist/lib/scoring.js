"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORE_WEIGHTS = void 0;
exports.weightedTotal = weightedTotal;
exports.layersWithTotal = layersWithTotal;
/** Layer weights — ARCHITECTURE.md §4.4 */
exports.SCORE_WEIGHTS = {
    pitch: 0.4,
    timing: 0.25,
    stability: 0.15,
    dynamics: 0.1,
    transitions: 0.1,
};
function weightedTotal(layers) {
    return Math.round(layers.scorePitch * exports.SCORE_WEIGHTS.pitch +
        layers.scoreTiming * exports.SCORE_WEIGHTS.timing +
        layers.scoreStability * exports.SCORE_WEIGHTS.stability +
        layers.scoreDynamics * exports.SCORE_WEIGHTS.dynamics +
        layers.scoreTransitions * exports.SCORE_WEIGHTS.transitions);
}
function layersWithTotal(layers) {
    return { ...layers, scoreTotal: weightedTotal(layers) };
}
