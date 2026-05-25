import type { PrismaClient } from "@prisma/client";
import { getRedis } from "./redis.js";
import { applyElo1v1, applyEloDraw, tierFromMmr } from "./mmr.js";

const PENDING_PREFIX = "voxarena:pending:";

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

  const redis = getRedis();
  if (redis) {
    await redis.del(
      `${PENDING_PREFIX}${match.player1Id}`,
      `${PENDING_PREFIX}${match.player2Id}`
    );
  }

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
