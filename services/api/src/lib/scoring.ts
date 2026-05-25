/** Layer weights — ARCHITECTURE.md §4.4 */
export const SCORE_WEIGHTS = {
  pitch: 0.4,
  timing: 0.25,
  stability: 0.15,
  dynamics: 0.1,
  transitions: 0.1,
} as const;

export type LayerScores = {
  scorePitch: number;
  scoreTiming: number;
  scoreStability: number;
  scoreDynamics: number;
  scoreTransitions: number;
};

export function weightedTotal(layers: LayerScores): number {
  return Math.round(
    layers.scorePitch * SCORE_WEIGHTS.pitch +
      layers.scoreTiming * SCORE_WEIGHTS.timing +
      layers.scoreStability * SCORE_WEIGHTS.stability +
      layers.scoreDynamics * SCORE_WEIGHTS.dynamics +
      layers.scoreTransitions * SCORE_WEIGHTS.transitions
  );
}

export function layersWithTotal(layers: LayerScores): LayerScores & { scoreTotal: number } {
  return { ...layers, scoreTotal: weightedTotal(layers) };
}
