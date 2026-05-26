import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { PrismaClient } from "@prisma/client";
import { setupLiveMatch } from "./liveMatch.js";
import { publishMatchFinalized } from "../lib/matchBus.js";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const STRANGER = "99999999-9999-4999-8999-999999999999";
const MATCH = "33333333-3333-4333-8333-333333333333";

const fakePrisma = {
  match: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      where.id === MATCH
        ? { id: MATCH, player1Id: P1, player2Id: P2, songId: "song-1", status: "pending" }
        : null,
  },
} as unknown as PrismaClient;

let httpServer: HttpServer;
let io: SocketServer;
let cleanup: () => void;
let port: number;
const clients: ClientSocket[] = [];

function connect(auth: Record<string, unknown>): ClientSocket {
  const c = ioc(`http://localhost:${port}`, {
    auth,
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
  });
  clients.push(c);
  return c;
}

function once<T = any>(socket: ClientSocket, event: string, timeoutMs = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function joinBoth(): Promise<{ c1: ClientSocket; c2: ClientSocket }> {
  const c1 = connect({ playerId: P1 });
  const c2 = connect({ playerId: P2 });
  await Promise.all([once(c1, "connect"), once(c2, "connect")]);
  const starts = Promise.all([once(c1, "match:start"), once(c2, "match:start")]);
  c1.emit("match:join", { matchId: MATCH });
  c2.emit("match:join", { matchId: MATCH });
  await starts;
  return { c1, c2 };
}

beforeEach(async () => {
  process.env.AUTH_DEV_BYPASS = "true";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  httpServer = createServer();
  io = new SocketServer(httpServer);
  cleanup = setupLiveMatch(io, fakePrisma);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as { port: number }).port;
});

afterEach(async () => {
  for (const c of clients) c.disconnect();
  clients.length = 0;
  cleanup();
  await new Promise<void>((resolve) => io.close(() => resolve()));
});

describe("live match (Socket.IO)", () => {
  it("rejects a connection without identity", async () => {
    const c = connect({});
    const err = await once<Error>(c, "connect_error");
    expect(String(err)).toMatch(/dev bypass|bearer|auth/i);
  });

  it("starts the match once both participants are present", async () => {
    const c1 = connect({ playerId: P1 });
    const c2 = connect({ playerId: P2 });
    await Promise.all([once(c1, "connect"), once(c2, "connect")]);

    const start = once<{ matchId: string; startsAt: number }>(c2, "match:start");
    c1.emit("match:join", { matchId: MATCH });
    c2.emit("match:join", { matchId: MATCH });

    const payload = await start;
    expect(payload.matchId).toBe(MATCH);
    expect(typeof payload.startsAt).toBe("number");
  });

  it("rejects a non-participant", async () => {
    const c = connect({ playerId: STRANGER });
    await once(c, "connect");
    const err = once<{ error: string }>(c, "match:error");
    c.emit("match:join", { matchId: MATCH });
    expect((await err).error).toMatch(/not a participant/i);
  });

  it("relays a player's progress to the opponent", async () => {
    const { c1, c2 } = await joinBoth();
    const got = once<{ playerId: string; score: number }>(c2, "opponent:progress");
    c1.emit("match:progress", { score: 42 });
    const payload = await got;
    expect(payload).toEqual({ playerId: P1, score: 42 });
  });

  it("pushes the authoritative result to the room on finalize", async () => {
    const { c1, c2 } = await joinBoth();
    const r1 = once<{ winnerId: string }>(c1, "match:result");
    const r2 = once<{ winnerId: string }>(c2, "match:result");
    publishMatchFinalized({
      matchId: MATCH,
      songId: "song-1",
      winnerId: P1,
      player1Id: P1,
      player2Id: P2,
      player1Score: 91,
      player2Score: 80,
      mmr: { player1Id: P1, player2Id: P2, newMmr1: 1016, newMmr2: 984 },
    });
    const [a, b] = await Promise.all([r1, r2]);
    expect(a.winnerId).toBe(P1);
    expect(b.winnerId).toBe(P1);
  });
});
