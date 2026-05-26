import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { performancesRouter } from "./performances.js";
import { botDuelRouter } from "./botDuel.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_UUID = "11111111-2222-4333-8444-555555555555";

// Auth gating must be decided before any DB access.
const prisma = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(`Prisma was accessed ("${String(prop)}") during an auth-gated path`);
    },
  }
) as unknown as PrismaClient;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/performances", performancesRouter(prisma));
  app.use("/bot", botDuelRouter(prisma));
  return app;
}

const app = buildApp();

beforeEach(() => {
  // Start each test with no Supabase and no bypass; tests opt in as needed.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.AUTH_DEV_BYPASS;
  delete process.env.NODE_ENV;
});

describe("auth gating on write routes", () => {
  it("returns 503 when neither Supabase nor dev bypass is configured", async () => {
    const res = await request(app).post("/performances").send({
      playerId: VALID_UUID,
      songId: OTHER_UUID,
      mode: "solo_practice",
    });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/auth not configured/i);
  });

  it("returns 401 in dev bypass when no identity is supplied", async () => {
    process.env.AUTH_DEV_BYPASS = "true";
    const res = await request(app).post("/performances").send({
      songId: OTHER_UUID,
      mode: "solo_practice",
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/x-player-id/i);
  });

  it("returns 403 when the body playerId does not match the identity", async () => {
    process.env.AUTH_DEV_BYPASS = "true";
    const res = await request(app)
      .post("/performances")
      .set("x-player-id", VALID_UUID)
      .send({ playerId: OTHER_UUID, songId: OTHER_UUID, mode: "solo_practice" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/does not match/i);
  });

  it("does not honor dev bypass when NODE_ENV=production", async () => {
    process.env.AUTH_DEV_BYPASS = "true";
    process.env.NODE_ENV = "production";
    const res = await request(app)
      .post("/performances")
      .set("x-player-id", VALID_UUID)
      .send({ playerId: VALID_UUID, songId: OTHER_UUID, mode: "solo_practice" });
    expect(res.status).toBe(503);
  });

  it("leaves public routes open (GET /bot/presets) regardless of auth", async () => {
    const res = await request(app).get("/bot/presets");
    expect(res.status).toBe(200);
    expect(res.body.presets.length).toBeGreaterThan(0);
  });
});
