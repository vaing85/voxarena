import type { Request, Response, NextFunction } from "express";
import type { PrismaClient } from "@prisma/client";
import { getSupabaseAdmin } from "./supabase.js";
import { isUuidString } from "./ids.js";

/** The identity attached to a request once authenticated. */
export type AuthedPlayer = {
  id: string;
  supabaseUserId?: string | null;
  email?: string | null;
};

declare module "express-serve-static-core" {
  interface Request {
    player?: AuthedPlayer;
  }
}

/** Supabase is the source of truth for identity when its env vars are set. */
export function isAuthConfigured(): boolean {
  return getSupabaseAdmin() !== null;
}

/**
 * Local-only escape hatch: skip token verification and trust an x-player-id
 * header. Never honored when NODE_ENV=production, so a misconfigured deploy
 * fails closed instead of running wide open.
 */
export function isDevBypassEnabled(): boolean {
  return (
    process.env.AUTH_DEV_BYPASS === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

type AuthResult =
  | { ok: true; player: AuthedPlayer }
  | { ok: false; status: number; error: string };

function bearerToken(req: Request): string | undefined {
  const header = req.header("authorization");
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token.trim();
}

/**
 * Resolve the acting player for a request.
 * - Supabase configured: verify the Bearer token, then find/link a Player by
 *   supabaseUserId (linking an existing unclaimed Player by email if present).
 * - Dev bypass: trust the x-player-id header (or body.playerId). No DB lookup —
 *   the route still validates the player exists.
 * - Neither: fail closed with 503.
 */
export async function authenticate(
  prisma: PrismaClient,
  req: Request
): Promise<AuthResult> {
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const token = bearerToken(req);
    if (!token) {
      return { ok: false, status: 401, error: "Missing bearer token" };
    }

    let userId: string;
    let email: string | null;
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return { ok: false, status: 401, error: "Invalid or expired token" };
      }
      userId = data.user.id;
      email = data.user.email ?? null;
    } catch {
      return { ok: false, status: 401, error: "Token verification failed" };
    }

    let player = await prisma.player.findUnique({
      where: { supabaseUserId: userId },
    });

    // Link an existing unclaimed account that shares this email.
    if (!player && email) {
      const byEmail = await prisma.player.findUnique({ where: { email } });
      if (byEmail && !byEmail.supabaseUserId) {
        player = await prisma.player.update({
          where: { id: byEmail.id },
          data: { supabaseUserId: userId },
        });
      }
    }

    if (!player) {
      player = await prisma.player.create({
        data: { supabaseUserId: userId, email: email ?? undefined },
      });
    }

    return {
      ok: true,
      player: {
        id: player.id,
        supabaseUserId: player.supabaseUserId,
        email: player.email,
      },
    };
  }

  if (isDevBypassEnabled()) {
    const headerId = req.header("x-player-id");
    const bodyId =
      typeof req.body?.playerId === "string" ? req.body.playerId : undefined;
    const pid = headerId ?? bodyId;
    if (typeof pid !== "string" || !isUuidString(pid)) {
      return {
        ok: false,
        status: 401,
        error: "Dev bypass: provide a valid x-player-id header (UUID)",
      };
    }
    return { ok: true, player: { id: pid } };
  }

  return {
    ok: false,
    status: 503,
    error:
      "Auth not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or AUTH_DEV_BYPASS=true for local dev)",
  };
}

/** Express middleware that requires a resolved player and attaches it to req. */
export function requireAuth(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await authenticate(prisma, req);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    req.player = result.player;
    next();
  };
}
