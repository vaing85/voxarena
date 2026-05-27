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

// Stateful fake: findUnique returns the live row, update mutates it, so
// startedAt persists across (re)joins the way the real DB would.
type MatchRow = {
  id: string;
  player1Id: string;
  player2Id: string;
  songId: string;
  status: string;
  startedAt: Date | null;
  winnerId: string | null;
  player1Score: number | null;
  player2Score: number | null;
};
let matchRow: MatchRow;

const fakePrisma = {
  match: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      where.id === matchRow.id ? matchRow : null,
    update: async ({ data }: { data: Partial<MatchRow> }) => {
      Object.assign(matchRow, data);
      return matchRow;
    },
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

  matchRow = {
    id: MATCH,
    player1Id: P1,
    player2Id: P2,
    songId: "song-1",
    status: "pending",
    startedAt: null,
    winnerId: null,
    player1Score: null,
    player2Score: null,
  };

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

  it("sends a state snapshot on join", async () => {
    const c1 = connect({ playerId: P1 });
    await once(c1, "connect");
    const state = once<{ status: string; players: string[]; startsAt: number | null }>(
      c1,
      "match:state"
    );
    c1.emit("match:join", { matchId: MATCH });
    const snap = await state;
    expect(snap.status).toBe("pending");
    expect(snap.players).toContain(P1);
    expect(snap.startsAt).toBeNull(); // not started until both present
  });

  it("resumes an in-progress round on reconnect without restarting it", async () => {
    const { c1 } = await joinBoth(); // both present -> round started, startedAt persisted
    c1.disconnect();

    const rejoin = connect({ playerId: P1 });
    await once(rejoin, "connect");
    const state = once<{ status: string; startsAt: number | null }>(rejoin, "match:state");
    // A restart would fire match:start again; assert it does NOT within a window.
    let restarted = false;
    rejoin.once("match:start", () => {
      restarted = true;
    });
    rejoin.emit("match:join", { matchId: MATCH });

    const snap = await state;
    expect(snap.status).toBe("pending");
    expect(typeof snap.startsAt).toBe("number"); // resumes the original countdown
    await new Promise((r) => setTimeout(r, 150));
    expect(restarted).toBe(false);
  });

  it("replays the result when a player reconnects after finalize", async () => {
    // Simulate the match having finalized while the player was away.
    matchRow.status = "completed";
    matchRow.winnerId = P1;
    matchRow.player1Score = 91;
    matchRow.player2Score = 80;

    const c = connect({ playerId: P1 });
    await once(c, "connect");
    const state = once<{ status: string; result: { winnerId: string } | null }>(
      c,
      "match:state"
    );
    c.emit("match:join", { matchId: MATCH });
    const snap = await state;
    expect(snap.status).toBe("completed");
    expect(snap.result?.winnerId).toBe(P1);
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
