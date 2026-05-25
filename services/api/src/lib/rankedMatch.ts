import type { PrismaClient } from "@prisma/client";
import { getRedis } from "./redis.js";
import { applyElo1v1, applyEloDraw, tierFromMmr } from "./mmr.js";

const PENDING_PREFIX = "voxarena:pending:";

// A pending ranked match is abandoned if not completed within this window.
const ABANDON_TIMEOUT_MS = 2 * 60 * 1000;
// MMR a no-show loses on top of the normal Elo loss.
const WALKOVER_PENALTY = 15;

async function clearPendingMarkers(
  player1Id: string,
  player2Id: string
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(
      `${PENDING_PREFIX}${player1Id}`,
      `${PENDING_PREFIX}${player2Id}`
    );
  }
}

export async function tryFinalizeRankedMatch(
  prisma: PrismaClient,
  matchId: string
): Promise<
  | { finalized: false; reason: string }
  | {
      finalized: true;
      winnerId: string | null;
      draw: boolean;
      match: { player1Score: number; player2Score: number };
      mmr: { player1Id: string; player2Id: string; newMmr1: number; newMmr2: number };
    }
> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      performances: {
        where: { mode: "ranked_pvp" },
      },
    },
  });

  if (!match) {
    return { finalized: false, reason: "match_not_found" };
  }
  if (match.status !== "pending") {
    return { finalized: false, reason: "already_finalized" };
  }

  const p1 = match.performances.find((p) => p.playerId === match.player1Id);
  const p2 = match.performances.find((p) => p.playerId === match.player2Id);
  if (!p1 || !p2) {
    return { finalized: false, reason: "waiting_for_both_performances" };
  }

  const s1 = p1.scoreTotal ?? 0;
  const s2 = p2.scoreTotal ?? 0;
  const draw = s1 === s2;
  const winnerId = draw ? null : s1 > s2 ? match.player1Id : match.player2Id;

  // Read MMRs and apply updates inside one transaction. The match row is
  // claimed with a status-conditional updateMany so two concurrent
  // finalizations (both players submitting at once) can't both apply MMR —
  // only the call whose claim affects a row proceeds.
  const outcome = await prisma.$transaction(async (tx) => {
    const claim = await tx.match.updateMany({
      where: { id: matchId, status: "pending" },
      data: {
        status: "completed",
        winnerId,
        player1Score: s1,
        player2Score: s2,
      },
    });
    if (claim.count === 0) {
      return null;
    }

    const [pl1, pl2] = await Promise.all([
      tx.player.findUnique({ where: { id: match.player1Id } }),
      tx.player.findUnique({ where: { id: match.player2Id } }),
    ]);
    if (!pl1 || !pl2) {
      throw new Error("player_missing");
    }

    let newMmr1: number;
    let newMmr2: number;
    let won1 = 0;
    let won2 = 0;

    if (draw) {
      const d = applyEloDraw(pl1.mmr, pl2.mmr);
      newMmr1 = d.new1;
      newMmr2 = d.new2;
    } else {
      const winnerIsP1 = winnerId === match.player1Id;
      const winnerMmr = winnerIsP1 ? pl1.mmr : pl2.mmr;
      const loserMmr = winnerIsP1 ? pl2.mmr : pl1.mmr;
      const { winnerNew, loserNew } = applyElo1v1(winnerMmr, loserMmr);
      newMmr1 = winnerIsP1 ? winnerNew : loserNew;
      newMmr2 = winnerIsP1 ? loserNew : winnerNew;
      won1 = winnerIsP1 ? 1 : 0;
      won2 = winnerIsP1 ? 0 : 1;
    }

    await Promise.all([
      tx.player.update({
        where: { id: match.player1Id },
        data: {
          mmr: newMmr1,
          tier: tierFromMmr(newMmr1),
          matchesPlayed: { increment: 1 },
          matchesWon: { increment: won1 },
        },
      }),
      tx.player.update({
        where: { id: match.player2Id },
        data: {
          mmr: newMmr2,
          tier: tierFromMmr(newMmr2),
          matchesPlayed: { increment: 1 },
          matchesWon: { increment: won2 },
        },
      }),
    ]);

    return { newMmr1, newMmr2 };
  });

  if (!outcome) {
    return { finalized: false, reason: "already_finalized" };
  }

  await clearPendingMarkers(match.player1Id, match.player2Id);

  return {
    finalized: true,
    winnerId,
    draw,
    match: { player1Score: s1, player2Score: s2 },
    mmr: {
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      newMmr1: outcome.newMmr1,
      newMmr2: outcome.newMmr2,
    },
  };
}

/**
 * Resolve a pending ranked match that has timed out without both performances.
 *  - one player submitted → that player wins by walkover; the no-show takes a
 *    normal Elo loss plus a fixed penalty
 *  - neither submitted → the match is voided with no MMR change
 * Lazy / on-demand: callers invoke this (e.g. the present player) once the
 * timeout has elapsed. `now` is injectable for testing.
 */
export async function tryResolveAbandonedMatch(
  prisma: PrismaClient,
  matchId: string,
  requesterId?: string,
  now: number = Date.now()
): Promise<
  | { resolved: false; reason: string; retryInMs?: number }
  | {
      resolved: true;
      outcome: "walkover";
      winnerId: string;
      loserId: string;
      mmr: { winnerNew: number; loserNew: number };
    }
  | { resolved: true; outcome: "void"; winnerId: null }
> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { performances: { where: { mode: "ranked_pvp" } } },
  });

  if (!match) {
    return { resolved: false, reason: "match_not_found" };
  }
  if (match.status !== "pending") {
    return { resolved: false, reason: "already_finalized" };
  }
  if (
    requesterId &&
    requesterId !== match.player1Id &&
    requesterId !== match.player2Id
  ) {
    return { resolved: false, reason: "not_participant" };
  }

  const age = now - match.createdAt.getTime();
  if (age < ABANDON_TIMEOUT_MS) {
    return { resolved: false, reason: "not_expired", retryInMs: ABANDON_TIMEOUT_MS - age };
  }

  const p1 = match.performances.find((p) => p.playerId === match.player1Id);
  const p2 = match.performances.find((p) => p.playerId === match.player2Id);

  // Both already submitted — this isn't abandoned; the normal finalize path
  // (triggered on performance submission) handles it.
  if (p1 && p2) {
    return { resolved: false, reason: "both_submitted" };
  }

  // Neither showed up — void with no rating change.
  if (!p1 && !p2) {
    const claim = await prisma.match.updateMany({
      where: { id: matchId, status: "pending" },
      data: { status: "abandoned" },
    });
    if (claim.count === 0) {
      return { resolved: false, reason: "already_finalized" };
    }
    await clearPendingMarkers(match.player1Id, match.player2Id);
    return { resolved: true, outcome: "void", winnerId: null };
  }

  // Exactly one submitted — walkover win for the submitter.
  const winnerId = p1 ? match.player1Id : match.player2Id;
  const loserId = p1 ? match.player2Id : match.player1Id;
  const winnerScore = (p1 ?? p2)?.scoreTotal ?? 0;

  const outcome = await prisma.$transaction(async (tx) => {
    const claim = await tx.match.updateMany({
      where: { id: matchId, status: "pending" },
      data: {
        status: "walkover",
        winnerId,
        player1Score: p1 ? winnerScore : 0,
        player2Score: p2 ? winnerScore : 0,
      },
    });
    if (claim.count === 0) {
      return null;
    }

    const [winner, loser] = await Promise.all([
      tx.player.findUnique({ where: { id: winnerId } }),
      tx.player.findUnique({ where: { id: loserId } }),
    ]);
    if (!winner || !loser) {
      throw new Error("player_missing");
    }

    const { winnerNew, loserNew } = applyElo1v1(winner.mmr, loser.mmr);
    const loserPenalized = Math.max(0, loserNew - WALKOVER_PENALTY);

    await Promise.all([
      tx.player.update({
        where: { id: winnerId },
        data: {
          mmr: winnerNew,
          tier: tierFromMmr(winnerNew),
          matchesPlayed: { increment: 1 },
          matchesWon: { increment: 1 },
        },
      }),
      tx.player.update({
        where: { id: loserId },
        data: {
          mmr: loserPenalized,
          tier: tierFromMmr(loserPenalized),
          matchesPlayed: { increment: 1 },
        },
      }),
    ]);

    return { winnerNew, loserNew: loserPenalized };
  });

  if (!outcome) {
    return { resolved: false, reason: "already_finalized" };
  }

  await clearPendingMarkers(match.player1Id, match.player2Id);

  return {
    resolved: true,
    outcome: "walkover",
    winnerId,
    loserId,
    mmr: outcome,
  };
}
