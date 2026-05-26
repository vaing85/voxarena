import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";

vi.mock("../lib/pitchClient.js", () => ({
  isPitchServiceConfigured: vi.fn(),
  analyzePitch: vi.fn(),
}));
import { isPitchServiceConfigured, analyzePitch } from "../lib/pitchClient.js";
import { performancesRouter } from "./performances.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const SONG_UUID = "11111111-2222-4333-8444-555555555555";

const throwingPrisma = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(`Prisma accessed ("${String(prop)}") before short-circuit`);
    },
  }
) as unknown as PrismaClient;

function buildApp(prisma: PrismaClient) {
  const app = express();
  app.use(express.json());
  app.use("/performances", performancesRouter(prisma));
  return app;
}

beforeEach(() => {
  vi.mocked(isPitchServiceConfigured).mockReset();
  vi.mocked(analyzePitch).mockReset();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NODE_ENV;
  process.env.AUTH_DEV_BYPASS = "true";
});

describe("POST /performances/audio", () => {
  it("returns 503 when the pitch service is not configured", async () => {
    vi.mocked(isPitchServiceConfigured).mockReturnValue(false);
    const res = await request(buildApp(throwingPrisma))
      .post("/performances/audio")
      .set("x-player-id", VALID_UUID)
      .field("playerId", VALID_UUID)
      .field("songId", SONG_UUID)
      .field("mode", "solo_practice")
      .attach("audio", Buffer.from("RIFFxxxx"), "a.wav");
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/pitch scoring unavailable/i);
  });

  it("returns 400 when the audio file is missing", async () => {
    vi.mocked(isPitchServiceConfigured).mockReturnValue(true);
    const res = await request(buildApp(throwingPrisma))
      .post("/performances/audio")
      .set("x-player-id", VALID_UUID)
      .field("playerId", VALID_UUID)
      .field("songId", SONG_UUID)
      .field("mode", "solo_practice");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/audio file is required/i);
  });

  it("rejects a non-UUID id before doing anything else", async () => {
    vi.mocked(isPitchServiceConfigured).mockReturnValue(true);
    const res = await request(buildApp(throwingPrisma))
      .post("/performances/audio")
      .set("x-player-id", VALID_UUID)
      .field("playerId", "nope")
      .field("songId", SONG_UUID)
      .field("mode", "solo_practice")
      .attach("audio", Buffer.from("x"), "a.wav");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uuid/i);
  });

  it("scores real pitch and stores the performance", async () => {
    vi.mocked(isPitchServiceConfigured).mockReturnValue(true);
    vi.mocked(analyzePitch).mockResolvedValue({
      scorePitch: 82.4,
      evaluatedFrames: 100,
      voicedFrames: 110,
      totalFrames: 120,
      voicedRatio: 0.92,
      meanCentsError: 18.2,
      scoreTiming: 70.6,
      matchedOnsets: 3,
      referenceOnsets: 4,
      meanOnsetErrorMs: 42.0,
      scoreStability: 63.2,
      evaluatedNotes: 4,
      meanStdCents: 36.8,
    });

    const created: any[] = [];
    const prisma = {
      player: { findUnique: async () => ({ id: VALID_UUID }) },
      song: {
        findUnique: async () => ({
          id: SONG_UUID,
          packId: null,
          referenceNotes: [{ start: 0, end: 2, midi: 60 }],
        }),
      },
      performance: {
        create: async ({ data }: any) => {
          created.push(data);
          return { id: "perf-1", ...data };
        },
      },
    } as unknown as PrismaClient;

    const res = await request(buildApp(prisma))
      .post("/performances/audio")
      .set("x-player-id", VALID_UUID)
      .field("playerId", VALID_UUID)
      .field("songId", SONG_UUID)
      .field("mode", "solo_practice")
      .attach("audio", Buffer.from("fake-wav-bytes"), "take.wav");

    expect(res.status).toBe(201);
    expect(res.body.pitch.scorePitch).toBe(82.4);
    expect(res.body.timing.scoreTiming).toBe(70.6);
    expect(res.body.stability.scoreStability).toBe(63.2);
    // Real pitch/timing/stability are rounded into the stored layers; total is recomputed.
    expect(res.body.performance.scorePitch).toBe(82);
    expect(res.body.performance.scoreTiming).toBe(71);
    expect(res.body.performance.scoreStability).toBe(63);
    expect(created[0].scorePitch).toBe(82);
    expect(created[0].scoreTiming).toBe(71);
    expect(created[0].scoreStability).toBe(63);
    expect(typeof res.body.performance.scoreTotal).toBe("number");
    expect(analyzePitch).toHaveBeenCalledOnce();
  });

  it("returns 422 when the song has no reference pitch", async () => {
    vi.mocked(isPitchServiceConfigured).mockReturnValue(true);
    const prisma = {
      player: { findUnique: async () => ({ id: VALID_UUID }) },
      song: {
        findUnique: async () => ({ id: SONG_UUID, packId: null, referenceNotes: null }),
      },
    } as unknown as PrismaClient;

    const res = await request(buildApp(prisma))
      .post("/performances/audio")
      .set("x-player-id", VALID_UUID)
      .field("playerId", VALID_UUID)
      .field("songId", SONG_UUID)
      .field("mode", "solo_practice")
      .attach("audio", Buffer.from("x"), "a.wav");
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/reference pitch/i);
  });
});
