/**
 * Pure single-elimination bracket helpers (seeding, byes, advancement).
 * No I/O so the tournament rules are unit-testable.
 */

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return 1 << Math.ceil(Math.log2(n));
}

/**
 * Standard seed slot order for a bracket of `size` (a power of two): returns
 * the seed numbers in bracket-slot order so #1 and #2 land in opposite halves.
 * e.g. size 8 -> [1, 8, 5, 4, 3, 6, 7, 2].
 */
export function seedSlots(size: number): number[] {
  let slots = [1, 2];
  while (slots.length < size) {
    const len = slots.length * 2;
    const next: number[] = [];
    for (const s of slots) {
      next.push(s);
      next.push(len + 1 - s);
    }
    slots = next;
  }
  return size === 1 ? [1] : slots;
}

export type RoundMatch = {
  slot: number;
  player1Id: string | null;
  player2Id: string | null;
};

/**
 * Build round-1 matches from players already ordered by seed (index 0 = seed 1,
 * highest MMR). Missing high seed numbers become byes, always paired opposite a
 * real top seed so two byes never meet.
 */
export function buildFirstRound(seededPlayerIds: string[]): RoundMatch[] {
  const size = nextPowerOfTwo(seededPlayerIds.length);
  if (size < 2) return [];
  const order = seedSlots(size);
  const playerForSeed = (seed: number): string | null => seededPlayerIds[seed - 1] ?? null;

  const matches: RoundMatch[] = [];
  for (let i = 0; i < size / 2; i++) {
    matches.push({
      slot: i,
      player1Id: playerForSeed(order[i * 2]),
      player2Id: playerForSeed(order[i * 2 + 1]),
    });
  }
  return matches;
}

/**
 * The winner of a round-1 match: the present player when the other side is a
 * bye, else null (must be decided by play).
 */
export function byeWinner(m: RoundMatch): string | null {
  if (m.player1Id && !m.player2Id) return m.player1Id;
  if (m.player2Id && !m.player1Id) return m.player2Id;
  return null;
}

/** Higher score wins; a tie goes to player1 (the higher seed in round 1). */
export function decideWinner(
  player1Id: string,
  player2Id: string,
  score1: number,
  score2: number
): string {
  return score2 > score1 ? player2Id : player1Id;
}

/** Pair consecutive winners into the next round's matches. */
export function nextRound(winners: (string | null)[]): RoundMatch[] {
  const matches: RoundMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    matches.push({
      slot: i / 2,
      player1Id: winners[i] ?? null,
      player2Id: winners[i + 1] ?? null,
    });
  }
  return matches;
}
