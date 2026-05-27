/**
 * Live PvP coordination over Socket.IO.
 *
 * The socket layer owns the *realtime session* only — presence, a synchronized
 * countdown, and relaying each player's live progress to their opponent. It is
 * NOT score-authoritative: players still submit scored performances via the
 * REST endpoints, and when a ranked match finalizes there, the authoritative
 * result is pushed to the room via the in-process match bus.
 */
import type { Server, Socket } from "socket.io";
import type { PrismaClient } from "@prisma/client";
import { authenticateSocket } from "./socketAuth.js";
import { matchBus, type MatchFinalized } from "../lib/matchBus.js";

const COUNTDOWN_MS = 3000;
const roomFor = (matchId: string) => `match:${matchId}`;

type SocketData = { playerId: string; matchId?: string };

async function presentPlayers(io: Server, matchId: string): Promise<string[]> {
  const sockets = await io.in(roomFor(matchId)).fetchSockets();
  return [...new Set(sockets.map((s) => (s.data as SocketData).playerId))];
}

/** Attach live-match handlers to a Socket.IO server. Returns a cleanup fn. */
export function setupLiveMatch(io: Server, prisma: PrismaClient): () => void {
  io.use(async (socket, next) => {
    const result = await authenticateSocket(prisma, socket);
    if (!result.ok) {
      next(new Error(result.error));
      return;
    }
    (socket.data as SocketData).playerId = result.player.id;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on("match:join", async (payload: { matchId?: unknown }) => {
      const matchId = payload?.matchId;
      if (typeof matchId !== "string") {
        socket.emit("match:error", { error: "matchId is required" });
        return;
      }
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) {
        socket.emit("match:error", { error: "match not found" });
        return;
      }
      if (data.playerId !== match.player1Id && data.playerId !== match.player2Id) {
        socket.emit("match:error", { error: "not a participant in this match" });
        return;
      }

      data.matchId = matchId;
      await socket.join(roomFor(matchId));

      const present = await presentPlayers(io, matchId);

      // Snapshot for the joining client — lets a reconnecting player resume the
      // session (resync the countdown, or see the result if it finished while
      // they were away) instead of starting from scratch.
      socket.emit("match:state", {
        matchId,
        status: match.status,
        players: present,
        startsAt: match.startedAt ? match.startedAt.getTime() + COUNTDOWN_MS : null,
        result:
          match.status === "completed"
            ? {
                winnerId: match.winnerId,
                player1Id: match.player1Id,
                player2Id: match.player2Id,
                player1Score: match.player1Score,
                player2Score: match.player2Score,
              }
            : null,
      });

      io.to(roomFor(matchId)).emit("match:presence", { matchId, players: present });

      const bothPresent = [match.player1Id, match.player2Id].every((id) =>
        present.includes(id)
      );
      // Only the FIRST time both are present starts the round; a later
      // reconnect must not restart a round already in progress.
      if (match.status === "pending" && bothPresent && !match.startedAt) {
        const startedAt = new Date();
        await prisma.match.update({
          where: { id: matchId },
          data: { startedAt },
        });
        io.to(roomFor(matchId)).emit("match:start", {
          matchId,
          startsAt: startedAt.getTime() + COUNTDOWN_MS,
        });
      }
    });

    // Live, non-authoritative progress relay (e.g. the opponent's score bar).
    socket.on("match:progress", (payload: { score?: unknown }) => {
      const matchId = data.matchId;
      const score = payload?.score;
      if (!matchId || typeof score !== "number") return;
      socket
        .to(roomFor(matchId))
        .emit("opponent:progress", { playerId: data.playerId, score });
    });

    socket.on("disconnect", async () => {
      const matchId = data.matchId;
      if (!matchId) return;
      const present = await presentPlayers(io, matchId);
      io.to(roomFor(matchId)).emit("match:presence", { matchId, players: present });
    });
  });

  // Authoritative result push when a ranked match finalizes via REST.
  const onFinalized = (event: MatchFinalized) => {
    io.to(roomFor(event.matchId)).emit("match:result", event);
  };
  matchBus.on("finalized", onFinalized);

  return () => {
    matchBus.off("finalized", onFinalized);
  };
}
