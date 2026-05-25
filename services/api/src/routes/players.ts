import { Router } from "express";
import type { PrismaClient } from "@prisma/client";

/** Phase 1: create a player without auth (for local testing). */
export function playersRouter(prisma: PrismaClient): Router {
  const r = Router();

  r.post("/", async (req, res) => {
    const name =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim().slice(0, 64)
        : "Player";

    const player = await prisma.player.create({
      data: { name },
      select: {
        id: true,
        name: true,
        mmr: true,
        tier: true,
        createdAt: true,
      },
    });
    res.status(201).json(player);
  });

  return r;
}
