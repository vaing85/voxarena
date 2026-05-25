"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingRouter = matchmakingRouter;
const express_1 = require("express");
const ids_js_1 = require("../lib/ids.js");
const matchmakingQueue_js_1 = require("../lib/matchmakingQueue.js");
function matchmakingRouter(prisma) {
    const r = (0, express_1.Router)();
    r.post("/ranked/join", async (req, res) => {
        const redis = (0, matchmakingQueue_js_1.getMatchmakingRedis)();
        if (!redis) {
            res.status(503).json({ error: "Matchmaking requires REDIS_URL" });
            return;
        }
        const { playerId, songId } = req.body ?? {};
        if (typeof playerId !== "string" || typeof songId !== "string") {
            res.status(400).json({ error: "playerId and songId required" });
            return;
        }
        if (!(0, ids_js_1.isUuidString)(playerId) || !(0, ids_js_1.isUuidString)(songId)) {
            res.status(400).json({ error: "Invalid UUID" });
            return;
        }
        const [player, song] = await Promise.all([
            prisma.player.findUnique({ where: { id: playerId } }),
            prisma.song.findUnique({ where: { id: songId } }),
        ]);
        if (!player || !song) {
            res.status(404).json({ error: "Player or song not found" });
            return;
        }
        const result = await (0, matchmakingQueue_js_1.rankedJoin)(redis, songId, playerId, {
            mmr: player.mmr,
            ts: Date.now(),
        });
        if (!result.matched) {
            res.json({ status: "queued", songId });
            return;
        }
        const { player1Id, player2Id } = result;
        const match = await prisma.match.create({
            data: {
                songId,
                difficulty: song.difficulty,
                player1Id,
                player2Id,
                status: "pending",
            },
        });
        await Promise.all([
            (0, matchmakingQueue_js_1.clearPlayerQueueMarker)(redis, player1Id),
            (0, matchmakingQueue_js_1.clearPlayerQueueMarker)(redis, player2Id),
            (0, matchmakingQueue_js_1.setPendingMatch)(redis, player1Id, match.id),
            (0, matchmakingQueue_js_1.setPendingMatch)(redis, player2Id, match.id),
        ]);
        res.status(201).json({
            status: "matched",
            matchId: match.id,
            songId,
            player1Id,
            player2Id,
        });
    });
    r.post("/ranked/leave", async (req, res) => {
        const redis = (0, matchmakingQueue_js_1.getMatchmakingRedis)();
        if (!redis) {
            res.status(503).json({ error: "Matchmaking requires REDIS_URL" });
            return;
        }
        const { playerId } = req.body ?? {};
        if (typeof playerId !== "string" || !(0, ids_js_1.isUuidString)(playerId)) {
            res.status(400).json({ error: "playerId (UUID) required" });
            return;
        }
        const songId = await (0, matchmakingQueue_js_1.getPlayerQueuedSong)(redis, playerId);
        if (!songId) {
            res.json({ left: false, reason: "not_in_queue" });
            return;
        }
        await (0, matchmakingQueue_js_1.rankedLeave)(redis, songId, playerId);
        res.json({ left: true, songId });
    });
    r.get("/ranked/pending/:playerId", async (req, res) => {
        const redis = (0, matchmakingQueue_js_1.getMatchmakingRedis)();
        if (!redis) {
            res.status(503).json({ error: "Matchmaking requires REDIS_URL" });
            return;
        }
        const { playerId } = req.params;
        if (!(0, ids_js_1.isUuidString)(playerId)) {
            res.status(400).json({ error: "Invalid playerId" });
            return;
        }
        const matchId = await (0, matchmakingQueue_js_1.getPendingMatch)(redis, playerId);
        res.json({ playerId, matchId });
    });
    return r;
}
