import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { isUuidString } from "../lib/ids.js";
import { actingPlayerId } from "../lib/auth.js";
import { tryResolveAbandonedMatch } from "../lib/rankedMatch.js";
import {
  getMatchmakingRedis,
  rankedJoin,
  rankedLeave,
  getPlayerQueuedSong,
  clearPlayerQueueMarker,
  setPendingMatch,
  getPendingMatch,
} from "../lib/matchmakingQueue.js";

export function matchmakingRouter(prisma: PrismaClient): Router {
  const r = Router();

  r.post("/ranked/join", async (req, res) => {
    const redis = getMatchmakingRedis();
    if (!redis) {
      res.status(503).json({ error: "Matchmaking requires REDIS_URL" });
      return;
    }

    const { songId } = req.body ?? {};
    const playerId = actingPlayerId(req, req.body?.playerId);
    if (typeof playerId !== "string" || typeof songId !== "string") {
      res.status(400).json({ error: "playerId and songId required" });
      return;
    }
    if (!isUuidString(playerId) || !isUuidString(songId)) {
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

    // Drop any stale queue entry for a different song first: the per-player
    // marker only tracks one song, so re-queueing elsewhere would otherwise
    // orphan the old entry in that song's queue hash.
    const existingSong = await getPlayerQueuedSong(redis, playerId);
    if (existingSong && existingSong !== songId) {
      await rankedLeave(redis, existingSong, playerId);
    }

    const result = await rankedJoin(redis, songId, playerId, {
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
      clearPlayerQueueMarker(redis, player1Id),
      clearPlayerQueueMarker(redis, player2Id),
      setPendingMatch(redis, player1Id, match.id),
      setPendingMatch(redis, player2Id, match.id),
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
    const redis = getMatchmakingRedis();
    if (!redis) {
      res.status(503).json({ error: "Matchmaking requires REDIS_URL" });
      return;
    }
    const playerId = actingPlayerId(req, req.body?.playerId);
    if (typeof playerId !== "string" || !isUuidString(playerId)) {
      res.status(400).json({ error: "playerId (UUID) required" });
      return;
    }
    const songId = await getPlayerQueuedSong(redis, playerId);
    if (!songId) {
      res.json({ left: false, reason: "not_in_queue" });
      return;
    }
    await rankedLeave(redis, songId, playerId);
    res.json({ left: true, songId });
  });

  r.get("/ranked/pending/:playerId", async (req, res) => {
    const redis = getMatchmakingRedis();
    if (!redis) {
      res.status(503).json({ error: "Matchmaking requires REDIS_URL" });
      return;
    }
    const playerId = actingPlayerId(req, req.params.playerId);
    if (typeof playerId !== "string" || !isUuidString(playerId)) {
      res.status(400).json({ error: "Invalid playerId" });
      return;
    }
    const matchId = await getPendingMatch(redis, playerId);
    res.json({ playerId, matchId });
  });

  // Resolve a pending ranked match that has timed out (opponent never
  // submitted). Doesn't require Redis. Walkover to the submitter, or void if
  // neither played.
  r.post("/ranked/resolve/:matchId", async (req, res) => {
    const { matchId } = req.params;
    if (!isUuidString(matchId)) {
      res.status(400).json({ error: "Invalid matchId" });
      return;
    }
    const requesterId = actingPlayerId(req, req.body?.playerId);
    const result = await tryResolveAbandonedMatch(
      prisma,
      matchId,
      typeof requesterId === "string" ? requesterId : undefined
    );

    if (!result.resolved) {
      const status =
        result.reason === "match_not_found"
          ? 404
          : result.reason === "not_participant"
            ? 403
            : 409;
      res.status(status).json(result);
      return;
    }
    res.json(result);
  });

  return r;
}
