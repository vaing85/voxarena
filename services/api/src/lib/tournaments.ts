import type { PrismaClient } from "@prisma/client";
import {
  buildFirstRound,
  byeWinner,
  decideWinner,
  nextRound,
} from "./bracket.js";

export type StartResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Seed the bracket by MMR (highest = seed 1), create round-1 matches,
 * auto-resolve byes, and flip the tournament to active.
 */
export async function startTournament(
  prisma: PrismaClient,
  tournamentId: string
): Promise<StartResult> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { entrants: { include: { player: { select: { mmr: true } } } } },
  });
  if (!tournament) return { ok: false, status: 404, error: "Tournament not found" };
  if (tournament.status !== "registration") {
    return { ok: false, status: 409, error: "Tournament already started" };
  }
  if (tournament.entrants.length < 2) {
    return { ok: false, status: 409, error: "Need at least 2 entrants to start" };
  }

  // Seed by MMR desc (stable by id for ties).
  const seeded = [...tournament.entrants].sort(
    (a, b) => b.player.mmr - a.player.mmr || a.playerId.localeCompare(b.playerId)
  );
  await prisma.$transaction(
    seeded.map((e, i) =>
      prisma.tournamentEntrant.update({ where: { id: e.id }, data: { seed: i + 1 } })
    )
  );

  const round1 = buildFirstRound(seeded.map((e) => e.playerId));
  await prisma.$transaction(
    round1.map((m) => {
      const winner = byeWinner(m);
      return prisma.tournamentMatch.create({
        data: {
          tournamentId,
          round: 1,
          slot: m.slot,
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          winnerId: winner,
          status: winner ? "completed" : "pending",
        },
      });
    })
  );

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: "active", startedAt: new Date() },
  });

  // A round made entirely of byes (or trivial brackets) should advance now.
  await tryAdvanceRound(prisma, tournamentId);
  return { ok: true };
}

/**
 * Record a player's score for their current pending match from one of their
 * performances (authoritative), decide the match when both scores are in, and
 * advance the bracket.
 */
export async function reportScore(
  prisma: PrismaClient,
  tournamentId: string,
  playerId: string,
  performanceId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return { ok: false, status: 404, error: "Tournament not found" };
  if (tournament.status !== "active") {
    return { ok: false, status: 409, error: "Tournament is not active" };
  }

  const performance = await prisma.performance.findUnique({ where: { id: performanceId } });
  if (!performance || performance.playerId !== playerId) {
    return { ok: false, status: 404, error: "Performance not found for this player" };
  }
  if (performance.songId !== tournament.songId) {
    return { ok: false, status: 400, error: "Performance is for a different song" };
  }

  const match = await prisma.tournamentMatch.findFirst({
    where: {
      tournamentId,
      status: "pending",
      OR: [{ player1Id: playerId }, { player2Id: playerId }],
    },
    orderBy: { round: "desc" },
  });
  if (!match) {
    return { ok: false, status: 409, error: "No pending match for this player" };
  }

  const isP1 = match.player1Id === playerId;
  const score = performance.scoreTotal ?? 0;
  const data =
    isP1 ? { player1Score: score } : { player2Score: score };

  const p1Score = isP1 ? score : match.player1Score;
  const p2Score = isP1 ? match.player2Score : score;

  if (p1Score != null && p2Score != null && match.player1Id && match.player2Id) {
    const winnerId = decideWinner(match.player1Id, match.player2Id, p1Score, p2Score);
    const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
    await prisma.tournamentMatch.update({
      where: { id: match.id },
      data: { ...data, winnerId, status: "completed" },
    });
    await prisma.tournamentEntrant.updateMany({
      where: { tournamentId, playerId: loserId },
      data: { eliminated: true },
    });
    await tryAdvanceRound(prisma, tournamentId);
  } else {
    await prisma.tournamentMatch.update({ where: { id: match.id }, data });
  }

  return { ok: true };
}

/**
 * If the current (highest) round is fully decided, generate the next round —
 * or, if a single winner remains, complete the tournament.
 */
async function tryAdvanceRound(prisma: PrismaClient, tournamentId: string): Promise<void> {
  const matches = await prisma.tournamentMatch.findMany({
    where: { tournamentId },
    orderBy: [{ round: "desc" }, { slot: "asc" }],
  });
  if (matches.length === 0) return;

  const maxRound = matches[0].round;
  const current = matches.filter((m) => m.round === maxRound).sort((a, b) => a.slot - b.slot);
  if (!current.every((m) => m.status === "completed")) return;

  const winners = current.map((m) => m.winnerId).filter((w): w is string => Boolean(w));

  if (winners.length <= 1) {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "completed", completedAt: new Date(), winnerId: winners[0] ?? null },
    });
    return;
  }

  const next = nextRound(winners);
  await prisma.$transaction(
    next.map((m) =>
      prisma.tournamentMatch.create({
        data: {
          tournamentId,
          round: maxRound + 1,
          slot: m.slot,
          player1Id: m.player1Id,
          player2Id: m.player2Id,
          status: "pending",
        },
      })
    )
  );
}
