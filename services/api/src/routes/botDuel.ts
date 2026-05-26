import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { isUuidString } from "../lib/ids.js";
import { requireAuth } from "../lib/auth.js";
import { HOUSE_BOT_DEVICE_ID } from "../config.js";
import { generateBotScores, listBotPresets, type BotPreset } from "../lib/bots.js";
import { computeStubScores } from "../lib/stubScore.js";

export function botDuelRouter(prisma: PrismaClient): Router {
  const r = Router();

  r.get("/presets", (_req, res) => {
    res.json({ presets: listBotPresets() });
  });

  /**
   * Solo vs bot: stores human + bot performances, completes Match, updates human stats (not bot MMR).
   */
  r.post("/solo-vs-bot", requireAuth(prisma), async (req, res) => {
    const { playerId, songId, botPreset } = req.body ?? {};
    if (
      typeof playerId !== "string" ||
      typeof songId !== "string" ||
      typeof botPreset !== "string"
    ) {
      res.status(400).json({
        error: "Body must include playerId, songId, botPreset",
      });
      return;
    }
    if (!isUuidString(playerId) || !isUuidString(songId)) {
      res.status(400).json({ error: "Invalid UUID" });
      return;
    }
    if (!listBotPresets().includes(botPreset as BotPreset)) {
      res.status(400).json({
        error: `botPreset must be one of: ${listBotPresets().join(", ")}`,
      });
      return;
    }
    if (req.player && req.player.id !== playerId) {
      res
        .status(403)
        .json({ error: "playerId does not match the authenticated user" });
      return;
    }

    const [human, song, houseBot] = await Promise.all([
      prisma.player.findUnique({ where: { id: playerId } }),
      prisma.song.findUnique({ where: { id: songId } }),
      prisma.player.findFirst({ where: { deviceId: HOUSE_BOT_DEVICE_ID } }),
    ]);

    if (!human || !song) {
      res.status(404).json({ error: "Player or song not found" });
      return;
    }
    if (!houseBot) {
      res.status(500).json({
        error: "House bot not seeded — run npm run db:seed",
      });
      return;
    }

    const seed = `${playerId}:${songId}:${botPreset}:${Date.now()}`;
    const hasAnyScore =
      req.body.scoreTotal != null || req.body.scorePitch != null;

    let humanLayers: ReturnType<typeof computeStubScores>;
    if (!hasAnyScore) {
      humanLayers = computeStubScores(seed);
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
            "Send all score fields or omit all for stub scoring",
        });
        return;
      }
      humanLayers = {
        scorePitch: pitch,
        scoreTiming: timing,
        scoreStability: stability,
        scoreDynamics: dynamics,
        scoreTransitions: transitions,
        scoreTotal: total,
      };
    }

    const botLayers = generateBotScores(
      botPreset as BotPreset,
      seed,
      song.difficulty
    );

    const humanTotal = humanLayers.scoreTotal;
    const botTotal = botLayers.scoreTotal;
    const humanWins = humanTotal >= botTotal;
    const winnerId = humanWins ? human.id : houseBot.id;

    const [humanPerf, botPerf, match] = await prisma.$transaction([
      prisma.performance.create({
        data: {
          playerId: human.id,
          songId,
          mode: "solo_vs_bot",
          scorePitch: humanLayers.scorePitch,
          scoreTiming: humanLayers.scoreTiming,
          scoreStability: humanLayers.scoreStability,
          scoreDynamics: humanLayers.scoreDynamics,
          scoreTransitions: humanLayers.scoreTransitions,
          scoreTotal: humanTotal,
        },
      }),
      prisma.performance.create({
        data: {
          playerId: houseBot.id,
          songId,
          mode: "solo_vs_bot",
          scorePitch: botLayers.scorePitch,
          scoreTiming: botLayers.scoreTiming,
          scoreStability: botLayers.scoreStability,
          scoreDynamics: botLayers.scoreDynamics,
          scoreTransitions: botLayers.scoreTransitions,
          scoreTotal: botTotal,
        },
      }),
      prisma.match.create({
        data: {
          songId,
          difficulty: song.difficulty,
          player1Id: human.id,
          player2Id: houseBot.id,
          status: "completed",
          winnerId,
          player1Score: humanTotal,
          player2Score: botTotal,
        },
      }),
    ]);

    await prisma.player.update({
      where: { id: human.id },
      data: {
        matchesPlayed: { increment: 1 },
        matchesWon: { increment: humanWins ? 1 : 0 },
      },
    });

    res.status(201).json({
      matchId: match.id,
      botPreset,
      humanPerformance: humanPerf,
      botPerformance: botPerf,
      scores: { human: humanTotal, bot: botTotal },
      winnerId,
      youWon: humanWins,
    });
  });

  return r;
}
