import type { RequestHandler } from "express";
import type { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth when a valid Supabase token is presented. */
      auth?: { playerId: string; supabaseUserId: string };
    }
  }
}

/** True when JWT verification is configured (i.e. enforced). */
export function authEnabled(): boolean {
  return Boolean(process.env.SUPABASE_JWT_SECRET);
}

/**
 * Auth middleware. When SUPABASE_JWT_SECRET is set, requires a valid Supabase
 * access token (HS256) and attaches req.auth with the local Player id —
 * creating the Player on first sight, keyed by the token's `sub`. When the
 * secret is unset (local dev), it's a no-op and routes fall back to the
 * playerId supplied in the request (Phase 1 behavior).
 */
export function requireAuth(prisma: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      next();
      return;
    }

    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }
    const token = header.slice("Bearer ".length).trim();

    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
      if (typeof decoded === "string") {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      payload = decoded;
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const sub = payload.sub;
    if (typeof sub !== "string" || sub.length === 0) {
      res.status(401).json({ error: "Token missing subject" });
      return;
    }

    const email =
      typeof payload.email === "string" ? payload.email : undefined;

    let player = await prisma.player.findUnique({
      where: { supabaseUserId: sub },
    });
    if (!player) {
      player = await prisma.player.create({
        data: { supabaseUserId: sub, email },
      });
    }

    req.auth = { playerId: player.id, supabaseUserId: sub };
    next();
  };
}

/**
 * Resolve the acting player id: the authenticated player when auth is
 * enforced, otherwise the caller-supplied id (dev fallback).
 */
export function actingPlayerId(
  req: { auth?: { playerId: string } },
  suppliedId: unknown
): string | undefined {
  if (req.auth) return req.auth.playerId;
  return typeof suppliedId === "string" ? suppliedId : undefined;
}
