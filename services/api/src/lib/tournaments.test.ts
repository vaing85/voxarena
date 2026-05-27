import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { startTournament, reportScore } from "./tournaments.js";

describe("startTournament", () => {
  it("seeds by MMR, creates round 1, and auto-resolves a bye", async () => {
    const createdMatches: any[] = [];
    const seedUpdates: any[] = [];
    const prisma = {
      tournament: {
        findUnique: async () => ({
          id: "t1",
          status: "registration",
          songId: "s1",
          entrants: [
            { id: "e1", playerId: "pA", player: { mmr: 1200 } },
            { id: "e2", playerId: "pB", player: { mmr: 1000 } },
            { id: "e3", playerId: "pC", player: { mmr: 1100 } },
          ],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      tournamentEntrant: {
        update: async (args: any) => {
          seedUpdates.push(args);
          return {};
        },
      },
      tournamentMatch: {
        create: async ({ data }: any) => {
          createdMatches.push(data);
          return data;
        },
        findMany: async () => createdMatches,
      },
      $transaction: async (ops: unknown[]) => Promise.all(ops),
    } as unknown as PrismaClient;

    const result = await startTournament(prisma, "t1");
    expect(result).toEqual({ ok: true });

    // 3 entrants -> bracket of 4 -> 2 round-1 matches.
    expect(createdMatches).toHaveLength(2);
    // Top seed (pA, 1200 MMR) gets the bye and is auto-advanced.
    const bye = createdMatches.find((m) => m.player2Id === null);
    expect(bye).toMatchObject({ player1Id: "pA", winnerId: "pA", status: "completed" });
    // The real match is pending (pB vs pC).
    const real = createdMatches.find((m) => m.player2Id !== null);
    expect(real.status).toBe("pending");
    expect(real.winnerId).toBeNull();
    // Seeds 1..3 were assigned, pA first.
    expect(seedUpdates[0].data.seed).toBe(1);
    expect((prisma.tournament.update as any).mock.calls[0][0].data.status).toBe("active");
  });

  it("refuses to start with fewer than 2 entrants", async () => {
    const prisma = {
      tournament: {
        findUnique: async () => ({ id: "t1", status: "registration", songId: "s1", entrants: [{ id: "e1", playerId: "pA", player: { mmr: 1000 } }] }),
      },
    } as unknown as PrismaClient;
    expect(await startTournament(prisma, "t1")).toMatchObject({ ok: false, status: 409 });
  });
});

describe("reportScore", () => {
  it("decides the final match and completes the tournament", async () => {
    const tournamentUpdate = vi.fn().mockResolvedValue({});
    const matchUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      tournament: {
        findUnique: async () => ({ id: "t1", status: "active", songId: "s1" }),
        update: tournamentUpdate,
      },
      performance: {
        findUnique: async () => ({ id: "perf", playerId: "pA", songId: "s1", scoreTotal: 90 }),
      },
      tournamentMatch: {
        findFirst: async () => ({
          id: "m1",
          player1Id: "pA",
          player2Id: "pB",
          player1Score: null,
          player2Score: 80, // opponent already reported
        }),
        update: matchUpdate,
        findMany: async () => [{ round: 1, slot: 0, winnerId: "pA", status: "completed" }],
      },
      tournamentEntrant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    } as unknown as PrismaClient;

    const result = await reportScore(prisma, "t1", "pA", "perf");
    expect(result).toEqual({ ok: true });
    // pA (90) beats pB (80); match completed with winner pA.
    expect(matchUpdate.mock.calls[0][0].data).toMatchObject({ winnerId: "pA", status: "completed" });
    // Single winner remains -> tournament completed.
    expect(tournamentUpdate.mock.calls[0][0].data).toMatchObject({ status: "completed", winnerId: "pA" });
  });

  it("rejects a performance for a different song", async () => {
    const prisma = {
      tournament: { findUnique: async () => ({ id: "t1", status: "active", songId: "s1" }) },
      performance: { findUnique: async () => ({ id: "perf", playerId: "pA", songId: "OTHER", scoreTotal: 90 }) },
    } as unknown as PrismaClient;
    expect(await reportScore(prisma, "t1", "pA", "perf")).toMatchObject({ ok: false, status: 400 });
  });
});
