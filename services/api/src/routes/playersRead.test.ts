import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { playersRouter } from "./players.js";

const PID = "550e8400-e29b-41d4-a716-446655440000";
const OPP = "660e8400-e29b-41d4-a716-446655440000";

function buildApp(prisma: PrismaClient) {
  const app = express();
  app.use(express.json());
  app.use("/players", playersRouter(prisma));
  return app;
}

describe("GET /players/:id (profile + stats)", () => {
  it("rejects a non-UUID id", async () => {
    const res = await request(buildApp({} as PrismaClient)).get("/players/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("404s when the player does not exist", async () => {
    const prisma = {
      player: { findUnique: async () => null },
    } as unknown as PrismaClient;
    const res = await request(buildApp(prisma)).get(`/players/${PID}`);
    expect(res.status).toBe(404);
  });

  it("returns profile with winRate, best score and performance count", async () => {
    const prisma = {
      player: {
        findUnique: async () => ({
          id: PID,
          name: "Ada",
          mmr: 1180,
          tier: "Silver",
          matchesPlayed: 4,
          matchesWon: 3,
          createdAt: new Date().toISOString(),
        }),
      },
      performance: {
        aggregate: async () => ({ _max: { scoreTotal: 96 } }),
        count: async () => 7,
      },
    } as unknown as PrismaClient;

    const res = await request(buildApp(prisma)).get(`/players/${PID}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: PID,
      name: "Ada",
      winRate: 0.75,
      bestScoreTotal: 96,
      performanceCount: 7,
    });
    expect(res.body.email).toBeUndefined(); // not exposed publicly
  });
});

describe("GET /players/:id/performances", () => {
  it("returns recent performances with song info", async () => {
    const prisma = {
      performance: {
        findMany: async () => [
          { id: "perf-1", scoreTotal: 88, song: { id: "s1", title: "Demo", difficulty: "easy" } },
        ],
      },
    } as unknown as PrismaClient;
    const res = await request(buildApp(prisma)).get(`/players/${PID}/performances?limit=5`);
    expect(res.status).toBe(200);
    expect(res.body.performances).toHaveLength(1);
    expect(res.body.performances[0].song.title).toBe("Demo");
  });
});

describe("GET /players/:id/matches", () => {
  it("frames each match from the player's perspective", async () => {
    const prisma = {
      match: {
        findMany: async () => [
          {
            id: "m1",
            player1Id: PID,
            player2Id: OPP,
            player1Score: 91,
            player2Score: 80,
            winnerId: PID,
            difficulty: "easy",
            songId: "s1",
            song: { id: "s1", title: "Demo", difficulty: "easy" },
            createdAt: new Date().toISOString(),
          },
        ],
      },
    } as unknown as PrismaClient;

    const res = await request(buildApp(prisma)).get(`/players/${PID}/matches`);
    expect(res.status).toBe(200);
    const m = res.body.matches[0];
    expect(m).toMatchObject({
      matchId: "m1",
      yourScore: 91,
      opponentId: OPP,
      opponentScore: 80,
      won: true,
    });
  });
});
