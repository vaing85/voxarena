import { layersWithTotal, type LayerScores } from "./scoring.js";

/**
 * Deterministic stub layer scores when the client sends none (dev / Phase 1).
 */
export function computeStubScores(seed: string): LayerScores & { scoreTotal: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const u = (n: number) => {
    const x = Math.abs(Math.sin(h + n) * 10000) % 1;
    return Math.round(60 + x * 40);
  };
  const layers: LayerScores = {
    scorePitch: u(1),
    scoreTiming: u(2),
    scoreStability: u(3),
    scoreDynamics: u(4),
    scoreTransitions: u(5),
  };
  return layersWithTotal(layers);
}
