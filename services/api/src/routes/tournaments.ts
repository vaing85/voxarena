import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireAuth } from "../lib/auth.js";
import { isUuidString } from "../lib/ids.js";
import { reportScore, startTournament } from "../lib/tournaments.js";

export function tournamentsRouter(prisma: PrismaClient): Router {
  const r = Router();

  /** List tournaments (optionally by status). Public. */
  r.get("/", async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const tournaments = await prisma.tournament.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { entrants: true } } },
    });
    res.json({
      tournaments: tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        songId: t.songId,
        status: t.status,
        entrantCount: t._count.entrants,
        winnerId: t.winnerId,
        createdAt: t.createdAt,
      })),
    });
  });

  /** Full bracket view. Public. */
  r.get("/:id", async (req, res) => {
    const { id } = req.params;
    if (!isUuidString(id)) {
      res.status(400).json({ error: "Invalid tournament id" });
      return;
    }
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        entrants: { orderBy: { seed: "asc" } },
        matches: { orderBy: [{ round: "asc" }, { slot: "asc" }] },
      },
    });
    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }
    res.json({ tournament });
  });

  /** Create a tournament for a song (opens registration). */
  r.post("/", requireAuth(prisma), async (req, res) => {
    const { name, songId } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (typeof songId !== "string" || !isUuidString(songId)) {
      res.status(400).json({ error: "songId (UUID) is required" });
      return;
    }
    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    const tournament = await prisma.tournament.create({
      data: { name: name.trim().slice(0, 80), songId },
    });
    res.status(201).json({ tournament });
  });

  /** Join an open tournament. */
  r.post("/:id/join", requireAuth(prisma), async (req, res) => {
    const { id } = req.params;
    if (!isUuidString(id)) {
      res.status(400).json({ error: "Invalid tournament id" });
      return;
    }
    const tournament = await prisma.tournament.findUnique({ where: { id } });
    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }
    if (tournament.status !== "registration") {
      res.status(409).json({ error: "Registration is closed" });
      return;
    }
    const playerId = req.player!.id;
    try {
      await prisma.tournamentEntrant.create({ data: { tournamentId: id, playerId } });
    } catch {
      res.status(409).json({ error: "Already registered" });
      return;
    }
    res.status(201).json({ joined: true });
  });

  /** Seed + start the bracket. */
  r.post("/:id/start", requireAuth(prisma), async (req, res) => {
    const { id } = req.params;
    if (!isUuidString(id)) {
      res.status(400).json({ error: "Invalid tournament id" });
      return;
    }
    const result = await startTournament(prisma, id);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ started: true });
  });

  /** Report a score for your current match from one of your performances. */
  r.post("/:id/report", requireAuth(prisma), async (req, res) => {
    const { id } = req.params;
    const { playerId, performanceId } = req.body ?? {};
    if (!isUuidString(id)) {
      res.status(400).json({ error: "Invalid tournament id" });
      return;
    }
    if (typeof playerId !== "string" || typeof performanceId !== "string") {
      res.status(400).json({ error: "playerId and performanceId are required" });
      return;
    }
    if (req.player && req.player.id !== playerId) {
      res.status(403).json({ error: "playerId does not match the authenticated user" });
      return;
    }
    const result = await reportScore(prisma, id, playerId, performanceId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ reported: true });
  });

  return r;
}
