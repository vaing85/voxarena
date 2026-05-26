import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  authenticate,
  isAuthConfigured,
  isDevBypassEnabled,
} from "../lib/auth.js";

const PLAYER_SELECT = {
  id: true,
  name: true,
  email: true,
  mmr: true,
  tier: true,
  createdAt: true,
} as const;

function sanitizeName(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim()
    ? raw.trim().slice(0, 64)
    : undefined;
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

  return r;
}
