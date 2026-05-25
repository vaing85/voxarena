"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performancesRouter = performancesRouter;
exports.leaderboardRouter = leaderboardRouter;
const express_1 = require("express");
const ids_js_1 = require("../lib/ids.js");
const stubScore_js_1 = require("../lib/stubScore.js");
const rankedMatch_js_1 = require("../lib/rankedMatch.js");
const config_js_1 = require("../config.js");
const MODES = new Set([
    "solo_practice",
    "solo_vs_bot",
    "ranked_pvp",
    "tournament",
]);
function performancesRouter(prisma) {
    const r = (0, express_1.Router)();
    r.post("/", async (req, res) => {
        const { playerId, songId, mode, matchId } = req.body ?? {};
        if (typeof playerId !== "string" ||
            typeof songId !== "string" ||
            typeof mode !== "string") {
            res.status(400).json({
                error: "Body must include playerId, songId, and mode (strings)",
            });
            return;
        }
        if (!(0, ids_js_1.isUuidString)(playerId) || !(0, ids_js_1.isUuidString)(songId)) {
            res.status(400).json({ error: "Invalid playerId or songId (expect UUID)" });
            return;
        }
        if (matchId != null && (typeof matchId !== "string" || !(0, ids_js_1.isUuidString)(matchId))) {
            res.status(400).json({ error: "matchId must be a UUID when provided" });
            return;
        }
        if (!MODES.has(mode)) {
            res.status(400).json({
                error: `mode must be one of: ${[...MODES].join(", ")}`,
            });
            return;
        }
        const [player, song] = await Promise.all([
            prisma.player.findUnique({ where: { id: playerId } }),
            prisma.song.findUnique({ where: { id: songId } }),
        ]);
        if (!player) {
            res.status(404).json({ error: "Player not found" });
            return;
        }
        if (!song) {
            res.status(404).json({ error: "Song not found" });
            return;
        }
        if (matchId) {
            if (mode !== "ranked_pvp") {
                res.status(400).json({ error: "matchId is only valid with mode ranked_pvp" });
                return;
            }
            const m = await prisma.match.findUnique({ where: { id: matchId } });
            if (!m || m.status !== "pending") {
                res.status(400).json({ error: "Invalid or closed match" });
                return;
            }
            if (m.songId !== songId) {
                res.status(400).json({ error: "songId does not match this match" });
                return;
            }
            if (playerId !== m.player1Id && playerId !== m.player2Id) {
                res.status(403).json({ error: "You are not a participant in this match" });
                return;
            }
            const already = await prisma.performance.findFirst({
                where: { matchId, playerId },
            });
            if (already) {
                res.status(409).json({ error: "Performance already recorded for this match" });
                return;
            }
        }
        const hasAnyScore = req.body.scoreTotal != null ||
            req.body.scorePitch != null ||
            req.body.scoreTiming != null;
        let scores;
        if (!hasAnyScore) {
            scores = (0, stubScore_js_1.computeStubScores)(`${playerId}:${songId}:${Date.now()}`);
        }
        else {
            const n = (v) => typeof v === "number" && Number.isFinite(v) ? v : undefined;
            const pitch = n(req.body.scorePitch);
            const timing = n(req.body.scoreTiming);
            const stability = n(req.body.scoreStability);
            const dynamics = n(req.body.scoreDynamics);
            const transitions = n(req.body.scoreTransitions);
            const total = n(req.body.scoreTotal);
            if (pitch == null ||
                timing == null ||
                stability == null ||
                dynamics == null ||
                transitions == null ||
                total == null) {
                res.status(400).json({
                    error: "If sending scores, provide all of: scorePitch, scoreTiming, scoreStability, scoreDynamics, scoreTransitions, scoreTotal",
                });
                return;
            }
            scores = {
                scorePitch: pitch,
                scoreTiming: timing,
                scoreStability: stability,
                scoreDynamics: dynamics,
                scoreTransitions: transitions,
                scoreTotal: total,
            };
        }
        const performance = await prisma.performance.create({
            data: {
                playerId,
                songId,
                mode,
                matchId: matchId ?? undefined,
                ...scores,
            },
            include: {
                song: { select: { id: true, title: true, difficulty: true } },
                player: { select: { id: true, name: true } },
            },
        });
        let rankedResult = null;
        if (matchId && mode === "ranked_pvp") {
            rankedResult = await (0, rankedMatch_js_1.tryFinalizeRankedMatch)(prisma, matchId);
        }
        res.status(201).json({
            performance,
            ranked: rankedResult,
        });
    });
    return r;
}
function leaderboardRouter(prisma) {
    const r = (0, express_1.Router)();
    r.get("/", async (req, res) => {
        const songId = req.query.songId;
        if (typeof songId !== "string" || !(0, ids_js_1.isUuidString)(songId)) {
            res.status(400).json({ error: "Query songId (UUID) is required" });
            return;
        }
        let limit = 10;
        if (req.query.limit != null) {
            const l = Number(req.query.limit);
            if (!Number.isInteger(l) || l < 1 || l > 100) {
                res.status(400).json({ error: "limit must be an integer 1–100" });
                return;
            }
            limit = l;
        }
        const song = await prisma.song.findUnique({ where: { id: songId } });
        if (!song) {
            res.status(404).json({ error: "Song not found" });
            return;
        }
        const houseBot = await prisma.player.findFirst({
            where: { deviceId: config_js_1.HOUSE_BOT_DEVICE_ID },
            select: { id: true },
        });
        const where = { songId };
        if (houseBot) {
            where.playerId = { not: houseBot.id };
        }
        const rows = await prisma.performance.findMany({
            where,
            orderBy: { scoreTotal: "desc" },
            take: limit,
            include: {
                player: { select: { id: true, name: true } },
                song: { select: { id: true, title: true, difficulty: true } },
            },
        });
        res.json({
            songId,
            song: { title: song.title, difficulty: song.difficulty },
            leaderboard: rows.map((row, index) => ({
                rank: index + 1,
                ...row,
            })),
        });
    });
    return r;
}
