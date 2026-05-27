import { Router, type Request, type Response, type NextFunction } from "express";
import type { PrismaClient } from "@prisma/client";

/**
 * Admin auth is intentionally separate from player auth: a static
 * `x-admin-token` matched against ADMIN_TOKEN. Fails closed (503) when unset.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    res.status(503).json({ error: "Admin not configured (ADMIN_TOKEN)" });
    return;
  }
  if (req.header("x-admin-token") !== token) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }
  next();
}

function clampLimit(raw: unknown, fallback = 50, max = 200): number {
  const n = typeof raw === "string" ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function adminRouter(prisma: PrismaClient): Router {
  const r = Router();

  /** Anti-cheat review queue. `status` = open (default) | reviewed | dismissed | all. */
  r.get("/flags", requireAdmin, async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "open";
    const flags = await prisma.cheatFlag.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: clampLimit(req.query.limit),
    });
    res.json({ flags });
  });

  /** Resolve a flag: mark reviewed or dismissed. */
  r.post("/flags/:id/resolve", requireAdmin, async (req, res) => {
    const status = req.body?.status;
    if (status !== "reviewed" && status !== "dismissed") {
      res.status(400).json({ error: "status must be 'reviewed' or 'dismissed'" });
      return;
    }
    try {
      const flag = await prisma.cheatFlag.update({
        where: { id: req.params.id },
        data: { status, reviewedAt: new Date() },
      });
      res.json({ flag });
    } catch {
      res.status(404).json({ error: "Flag not found" });
    }
  });

  return r;
}
