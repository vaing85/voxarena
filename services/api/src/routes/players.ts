import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  authenticate,
  isAuthConfigured,
  isDevBypassEnabled,
} from "../lib/auth.js";
import { isUuidString } from "../lib/ids.js";

const PLAYER_SELECT = {
  id: true,
  name: true,
  email: true,
  mmr: true,
  tier: true,
  createdAt: true,
} as const;

/** Public profile fields — note email is intentionally excluded. */
const PROFILE_SELECT = {
  id: true,
  name: true,
  mmr: true,
  tier: true,
  matchesPlayed: true,
  matchesWon: true,
  createdAt: true,
} as const;

const SONG_SELECT = { id: true, title: true, difficulty: true } as const;

function sanitizeName(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim()
    ? raw.trim().slice(0, 64)
    : undefined;
}

function clampLimit(raw: unknown, fallback = 20, max = 100): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function playersRouter(prisma: PrismaClient): Router {
  const r = Router();

  /**
   * Register / link the current player.
   * - Supabase configured: requires a token; finds-or-creates the Player linked
   *   to the authenticated Supabase user (idempotent), optionally setting name.
   * - Dev bypass: creates an unlinked Player (Phase 1 local flow). The returned
   *   id is what you pass as the x-player-id header on subsequent calls.
   */
  r.post("/", async (req, res) => {
    const name = sanitizeName(req.body?.name);

    if (isAuthConfigured()) {
      const result = await authenticate(prisma, req);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      const player = await prisma.player.update({
        where: { id: result.player.id },
        data: name ? { name } : {},
        select: PLAYER_SELECT,
      });
      res.status(201).json(player);
      return;
    }

    if (isDevBypassEnabled()) {
      const player = await prisma.player.create({
        data: { name: name ?? "Player" },
        select: PLAYER_SELECT,
      });
      res.status(201).json(player);
      return;
    }

    res.status(503).json({
      error:
        "Auth not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or AUTH_DEV_BYPASS=true for local dev)",
    });
  });

  /** Public profile + lifetime stats. */
  r.get("/:id", async (req, res) => {
    const { id } = req.params;
    if (!isUuidString(id)) {
      res.status(400).json({ error: "Invalid player id" });
      return;
    }
    const player = await prisma.player.findUnique({
      where: { id },
      select: PROFILE_SELECT,
    });
    if (!player) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    const [best, performanceCount] = await Promise.all([
      prisma.performance.aggregate({
        where: { playerId: id },
        _max: { scoreTotal: true },
      }),
      prisma.performance.count({ where: { playerId: id } }),
    ]);
    const winRate =
      player.matchesPlayed > 0
        ? Math.round((player.matchesWon / player.matchesPlayed) * 1000) / 1000
        : 0;
    res.json({
      ...player,
      winRate,
      performanceCount,
      bestScoreTotal: best._max.scoreTotal ?? null,
    });
  });

  /** Recent performances for a player (most recent first). */
  r.get("/:id/performances", async (req, res) => {
    const { id } = req.params;
    if (!isUuidString(id)) {
      res.status(400).json({ error: "Invalid player id" });
      return;
    }
    const performances = await prisma.performance.findMany({
      where: { playerId: id },
      orderBy: { createdAt: "desc" },
      take: clampLimit(req.query.limit),
      include: { song: { select: SONG_SELECT } },
    });
    res.json({ playerId: id, performances });
  });

  /** Recent completed matches for a player, framed from their perspective. */
  r.get("/:id/matches", async (req, res) => {
    const { id } = req.params;
    if (!isUuidString(id)) {
      res.status(400).json({ error: "Invalid player id" });
      return;
    }
    const matches = await prisma.match.findMany({
      where: { status: "completed", OR: [{ player1Id: id }, { player2Id: id }] },
      orderBy: { createdAt: "desc" },
      take: clampLimit(req.query.limit),
      include: { song: { select: SONG_SELECT } },
    });
    const framed = matches.map((m) => {
      const isP1 = m.player1Id === id;
      return {
        matchId: m.id,
        song: m.song,
        difficulty: m.difficulty,
        yourScore: isP1 ? m.player1Score : m.player2Score,
        opponentId: isP1 ? m.player2Id : m.player1Id,
        opponentScore: isP1 ? m.player2Score : m.player1Score,
        won: m.winnerId === id,
        playedAt: m.createdAt,
      };
    });
    res.json({ playerId: id, matches: framed });
  });

  return r;
}
