"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryFinalizeRankedMatch = tryFinalizeRankedMatch;
const redis_js_1 = require("./redis.js");
const mmr_js_1 = require("./mmr.js");
const PENDING_PREFIX = "voxarena:pending:";
async function tryFinalizeRankedMatch(prisma, matchId) {
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
    const winnerId = s1 > s2 ? match.player1Id : s1 < s2 ? match.player2Id : match.player1Id;
    const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
    const [winner, loser] = await Promise.all([
        prisma.player.findUnique({ where: { id: winnerId } }),
        prisma.player.findUnique({ where: { id: loserId } }),
    ]);
    if (!winner || !loser) {
        return { finalized: false, reason: "player_missing" };
    }
    const { winnerNew, loserNew } = (0, mmr_js_1.applyElo1v1)(winner.mmr, loser.mmr);
    await prisma.$transaction([
        prisma.player.update({
            where: { id: winnerId },
            data: {
                mmr: winnerNew,
                tier: (0, mmr_js_1.tierFromMmr)(winnerNew),
                matchesPlayed: { increment: 1 },
                matchesWon: { increment: 1 },
            },
        }),
        prisma.player.update({
            where: { id: loserId },
            data: {
                mmr: loserNew,
                tier: (0, mmr_js_1.tierFromMmr)(loserNew),
                matchesPlayed: { increment: 1 },
            },
        }),
        prisma.match.update({
            where: { id: matchId },
            data: {
                status: "completed",
                winnerId,
                player1Score: s1,
                player2Score: s2,
            },
        }),
    ]);
    const redis = (0, redis_js_1.getRedis)();
    if (redis) {
        await redis.del(`${PENDING_PREFIX}${match.player1Id}`, `${PENDING_PREFIX}${match.player2Id}`);
    }
    const newMmr1 = match.player1Id === winnerId ? winnerNew : loserNew;
    const newMmr2 = match.player2Id === winnerId ? winnerNew : loserNew;
    return {
        finalized: true,
        winnerId,
        match: { player1Score: s1, player2Score: s2 },
        mmr: {
            player1Id: match.player1Id,
            player2Id: match.player2Id,
            newMmr1,
            newMmr2,
        },
    };
}
