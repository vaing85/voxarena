import type { PrismaClient } from "@prisma/client";
import type { Socket } from "socket.io";
import { authenticate } from "../lib/auth.js";

/**
 * Resolve the acting player for a socket connection by reusing the HTTP
 * `authenticate` path. The client passes identity via `socket.handshake.auth`
 * — `{ token }` for Supabase or `{ playerId }` for dev bypass — which we adapt
 * to the header shape `authenticate` expects.
 */
export function authenticateSocket(prisma: PrismaClient, socket: Socket) {
  const auth = (socket.handshake.auth ?? {}) as {
    token?: string;
    playerId?: string;
  };
  const headers = socket.handshake.headers ?? {};

  const shim = {
    header(name: string): string | undefined {
      const n = name.toLowerCase();
      if (n === "authorization") {
        return auth.token
          ? `Bearer ${auth.token}`
          : (headers["authorization"] as string | undefined);
      }
      if (n === "x-player-id") {
        return auth.playerId ?? (headers["x-player-id"] as string | undefined);
      }
      return undefined;
    },
    body: {} as Record<string, unknown>,
  };

  // authenticate only uses `.header()` and `.body`; the shim satisfies both.
  return authenticate(prisma, shim as never);
}
