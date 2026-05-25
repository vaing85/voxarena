const TIERS: { name: string; minMmr: number }[] = [
  { name: "Bronze", minMmr: 0 },
  { name: "Silver", minMmr: 1100 },
  { name: "Gold", minMmr: 1250 },
  { name: "Platinum", minMmr: 1400 },
  { name: "Diamond", minMmr: 1550 },
  { name: "Master", minMmr: 1700 },
];

export function tierFromMmr(mmr: number): string {
  let tier = TIERS[0].name;
  for (const t of TIERS) {
    if (mmr >= t.minMmr) tier = t.name;
  }
  return tier;
}

/** Elo expected score for player A (0–1). */
export function expectedScore(mmrA: number, mmrB: number): number {
  return 1 / (1 + Math.pow(10, (mmrB - mmrA) / 400));
}

/**
 * 1v1 Elo update. Returns new MMR for winner and loser.
 * `k` scales how fast ratings move (default 32).
 */
export function applyElo1v1(
  winnerMmr: number,
  loserMmr: number,
  k = 32
): { winnerNew: number; loserNew: number } {
  const ew = expectedScore(winnerMmr, loserMmr);
  const el = expectedScore(loserMmr, winnerMmr);
  const winnerNew = Math.round(winnerMmr + k * (1 - ew));
  const loserNew = Math.round(loserMmr + k * (0 - el));
  return { winnerNew, loserNew };
}
