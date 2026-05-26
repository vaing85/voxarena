import { Router } from "express";
import multer from "multer";
import type { Prisma, PrismaClient } from "@prisma/client";
import { isUuidString } from "../lib/ids.js";
import { computeStubScores } from "../lib/stubScore.js";
import { weightedTotal } from "../lib/scoring.js";
import { tryFinalizeRankedMatch } from "../lib/rankedMatch.js";
import { requireAuth } from "../lib/auth.js";
import { canPlaySong } from "../lib/entitlements.js";
import { analyzePitch, isPitchServiceConfigured } from "../lib/pitchClient.js";
import { HOUSE_BOT_DEVICE_ID } from "../config.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const MODES = new Set([
  "solo_practice",
  "solo_vs_bot",
  "ranked_pvp",
  "tournament",
]);

export function performancesRouter(prisma: PrismaClient): Router {
  const r = Router();

  r.post("/", requireAuth(prisma), async (req, res) => {
    const { playerId, songId, mode, matchId } = req.body ?? {};
    if (
      typeof playerId !== "string" ||
      typeof songId !== "string" ||
      typeof mode !== "string"
    ) {
      res.status(400).json({
        error: "Body must include playerId, songId, and mode (strings)",
      });
      return;
    }
    if (!isUuidString(playerId) || !isUuidString(songId)) {
      res.status(400).json({ error: "Invalid playerId or songId (expect UUID)" });
      return;
    }
    if (matchId != null && (typeof matchId !== "string" || !isUuidString(matchId))) {
      res.status(400).json({ error: "matchId must be a UUID when provided" });
      return;
    }
    if (!MODES.has(mode)) {
      res.status(400).json({
        error: `mode must be one of: ${[...MODES].join(", ")}`,
      });
      return;
    }
    if (req.player && req.player.id !== playerId) {
      res
        .status(403)
        .json({ error: "playerId does not match the authenticated user" });
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
    if (!(await canPlaySong(prisma, playerId, song))) {
      res
        .status(403)
        .json({ error: "Song is locked — purchase the pack to play it" });
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

    const hasAnyScore =
      req.body.scoreTotal != null ||
      req.body.scorePitch != null ||
      req.body.scoreTiming != null;

    let scores: {
      scorePitch: number;
      scoreTiming: number;
      scoreStability: number;
      scoreDynamics: number;
      scoreTransitions: number;
      scoreTotal: number;
    };

    if (!hasAnyScore) {
      scores = computeStubScores(`${playerId}:${songId}:${Date.now()}`);
    } else {
      const n = (v: unknown): number | undefined =>
        typeof v === "number" && Number.isFinite(v) ? v : undefined;
      const pitch = n(req.body.scorePitch);
      const timing = n(req.body.scoreTiming);
      const stability = n(req.body.scoreStability);
      const dynamics = n(req.body.scoreDynamics);
      const transitions = n(req.body.scoreTransitions);
      const total = n(req.body.scoreTotal);
      if (
        pitch == null ||
        timing == null ||
        stability == null ||
        dynamics == null ||
        transitions == null ||
        total == null
      ) {
        res.status(400).json({
          error:
            "If sending scores, provide all of: scorePitch, scoreTiming, scoreStability, scoreDynamics, scoreTransitions, scoreTotal",
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

    let rankedResult: Awaited<ReturnType<typeof tryFinalizeRankedMatch>> | null =
      null;
    if (matchId && mode === "ranked_pvp") {
      rankedResult = await tryFinalizeRankedMatch(prisma, matchId);
    }

    res.status(201).json({
      performance,
      ranked: rankedResult,
    });
  });

  /**
   * Audio-scored performance: the client uploads recorded audio (WAV), the
   * pitch service computes a real Layer A (pitch) score against the song's
   * reference melody, and the server stores it. Other layers stay heuristic.
   */
  r.post(
    "/audio",
    requireAuth(prisma),
    upload.single("audio"),
    async (req, res) => {
      const { playerId, songId, mode, matchId } = req.body ?? {};
      if (
        typeof playerId !== "string" ||
        typeof songId !== "string" ||
        typeof mode !== "string"
      ) {
        res.status(400).json({
          error: "Form must include playerId, songId, and mode",
        });
        return;
      }
      if (!isUuidString(playerId) || !isUuidString(songId)) {
        res.status(400).json({ error: "Invalid playerId or songId (expect UUID)" });
        return;
      }
      if (matchId != null && (typeof matchId !== "string" || !isUuidString(matchId))) {
        res.status(400).json({ error: "matchId must be a UUID when provided" });
        return;
      }
      if (!MODES.has(mode)) {
        res.status(400).json({ error: `mode must be one of: ${[...MODES].join(", ")}` });
        return;
      }
      if (req.player && req.player.id !== playerId) {
        res.status(403).json({ error: "playerId does not match the authenticated user" });
        return;
      }
      if (!isPitchServiceConfigured()) {
        res.status(503).json({ error: "Pitch scoring unavailable (PITCH_SERVICE_URL not set)" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "audio file is required (field 'audio')" });
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
      if (!(await canPlaySong(prisma, playerId, song))) {
        res.status(403).json({ error: "Song is locked — purchase the pack to play it" });
        return;
      }

      const reference = song.referenceNotes;
      if (!Array.isArray(reference) || reference.length === 0) {
        res.status(422).json({ error: "Song has no reference pitch data" });
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
        const already = await prisma.performance.findFirst({ where: { matchId, playerId } });
        if (already) {
          res.status(409).json({ error: "Performance already recorded for this match" });
          return;
        }
      }

      let analysis;
      try {
        analysis = await analyzePitch(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          reference
        );
      } catch (e) {
        res.status(502).json({ error: `Pitch service error: ${String(e)}` });
        return;
      }
      if (analysis.scorePitch == null) {
        res.status(422).json({ error: "Could not score pitch (no voiced frames matched the reference)" });
        return;
      }

      // Real pitch (A) + timing (B) + stability (C); D/E stay heuristic.
      const others = computeStubScores(`${playerId}:${songId}:${Date.now()}`);
      const layers = {
        scorePitch: Math.round(analysis.scorePitch),
        scoreTiming:
          analysis.scoreTiming != null
            ? Math.round(analysis.scoreTiming)
            : others.scoreTiming,
        scoreStability:
          analysis.scoreStability != null
            ? Math.round(analysis.scoreStability)
            : others.scoreStability,
        scoreDynamics: others.scoreDynamics,
        scoreTransitions: others.scoreTransitions,
      };
      const scoreTotal = weightedTotal(layers);

      const performance = await prisma.performance.create({
        data: {
          playerId,
          songId,
          mode,
          matchId: matchId ?? undefined,
          ...layers,
          scoreTotal,
        },
        include: {
          song: { select: { id: true, title: true, difficulty: true } },
          player: { select: { id: true, name: true } },
        },
      });

      let rankedResult: Awaited<ReturnType<typeof tryFinalizeRankedMatch>> | null = null;
      if (matchId && mode === "ranked_pvp") {
        rankedResult = await tryFinalizeRankedMatch(prisma, matchId);
      }

      res.status(201).json({
        performance,
        ranked: rankedResult,
        pitch: {
          scorePitch: analysis.scorePitch,
          meanCentsError: analysis.meanCentsError,
          voicedRatio: analysis.voicedRatio,
          evaluatedFrames: analysis.evaluatedFrames,
        },
        timing: {
          scoreTiming: analysis.scoreTiming,
          meanOnsetErrorMs: analysis.meanOnsetErrorMs,
          matchedOnsets: analysis.matchedOnsets,
          referenceOnsets: analysis.referenceOnsets,
        },
        stability: {
          scoreStability: analysis.scoreStability,
          meanStdCents: analysis.meanStdCents,
          evaluatedNotes: analysis.evaluatedNotes,
        },
      });
    }
  );

  return r;
}

export function leaderboardRouter(prisma: PrismaClient): Router {
  const r = Router();

  r.get("/", async (req, res) => {
    const songId = req.query.songId;
    if (typeof songId !== "string" || !isUuidString(songId)) {
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
      where: { deviceId: HOUSE_BOT_DEVICE_ID },
      select: { id: true },
    });
    const where: Prisma.PerformanceWhereInput = { songId };
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
