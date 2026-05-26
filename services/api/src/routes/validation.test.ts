import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { songsRouter } from "./songs.js";
import { performancesRouter, leaderboardRouter } from "./performances.js";
import { matchmakingRouter } from "./matchmaking.js";
import { botDuelRouter } from "./botDuel.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_UUID = "11111111-2222-4333-8444-555555555555";

// Any DB access during a pure-validation path is a bug: the request should be
// rejected before it ever reaches Prisma. This proxy turns that into a failure.
const prisma = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(
        `Prisma was accessed ("${String(prop)}") before validation rejected the request`
      );
    },
  }
) as unknown as PrismaClient;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/songs", songsRouter(prisma));
  app.use("/performances", performancesRouter(prisma));
  app.use("/leaderboard", leaderboardRouter(prisma));
  app.use("/matchmaking", matchmakingRouter(prisma));
  app.use("/bot", botDuelRouter(prisma));
  return app;
}

let app: express.Express;

beforeAll(() => {
  // Matchmaking short-circuits to 503 when Redis is not configured.
  delete process.env.REDIS_URL;
  app = buildApp();
});

describe("GET /songs/:id", () => {
  it("rejects a non-UUID id", async () => {
    const res = await request(app).get("/songs/not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid song id/i);
  });
});

describe("GET /leaderboard", () => {
  it("requires a songId query param", async () => {
    const res = await request(app).get("/leaderboard");
    expect(res.status).toBe(400);
  });

  it("rejects a non-UUID songId", async () => {
    const res = await request(app).get("/leaderboard?songId=nope");
    expect(res.status).toBe(400);
  });

  it.each(["0", "101", "abc", "1.5"])(
    "rejects out-of-range/invalid limit %s",
    async (limit) => {
      const res = await request(app).get(
        `/leaderboard?songId=${VALID_UUID}&limit=${limit}`
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/limit/i);
    }
  );
});

describe("POST /performances", () => {
  it("rejects a missing body", async () => {
    const res = await request(app).post("/performances").send({});
    expect(res.status).toBe(400);
  });

  it("rejects a non-UUID playerId/songId", async () => {
    const res = await request(app)
      .post("/performances")
      .send({ playerId: "x", songId: "y", mode: "solo_practice" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uuid/i);
  });

  it("rejects an invalid mode", async () => {
    const res = await request(app)
      .post("/performances")
      .send({ playerId: VALID_UUID, songId: OTHER_UUID, mode: "karaoke" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mode/i);
  });

  it("rejects a non-UUID matchId", async () => {
    const res = await request(app).post("/performances").send({
      playerId: VALID_UUID,
      songId: OTHER_UUID,
      mode: "ranked_pvp",
      matchId: "not-a-uuid",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/matchId/i);
  });
});

describe("GET /bot/presets", () => {
  it("returns the preset list without touching the DB", async () => {
    const res = await request(app).get("/bot/presets");
    expect(res.status).toBe(200);
    expect(res.body.presets).toEqual(
      expect.arrayContaining(["rookie", "pro", "metro", "soul"])
    );
  });
});

describe("POST /bot/solo-vs-bot", () => {
  it("rejects a missing body", async () => {
    const res = await request(app).post("/bot/solo-vs-bot").send({});
    expect(res.status).toBe(400);
  });

  it("rejects a non-UUID id", async () => {
    const res = await request(app)
      .post("/bot/solo-vs-bot")
      .send({ playerId: "x", songId: "y", botPreset: "pro" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uuid/i);
  });

  it("rejects an unknown bot preset", async () => {
    const res = await request(app).post("/bot/solo-vs-bot").send({
      playerId: VALID_UUID,
      songId: OTHER_UUID,
      botPreset: "diva",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/botPreset/i);
  });
});

describe("matchmaking without Redis", () => {
  it("POST /matchmaking/ranked/join returns 503", async () => {
    const res = await request(app)
      .post("/matchmaking/ranked/join")
      .send({ playerId: VALID_UUID, songId: OTHER_UUID });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/redis/i);
  });

  it("POST /matchmaking/ranked/leave returns 503", async () => {
    const res = await request(app)
      .post("/matchmaking/ranked/leave")
      .send({ playerId: VALID_UUID });
    expect(res.status).toBe(503);
  });

  it("GET /matchmaking/ranked/pending/:playerId returns 503", async () => {
    const res = await request(app).get(
      `/matchmaking/ranked/pending/${VALID_UUID}`
    );
    expect(res.status).toBe(503);
  });
});
