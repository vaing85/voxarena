import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { storeRouter, storeWebhookHandler } from "./store.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

const PACKS = [
  {
    id: "p1",
    slug: "starter",
    name: "Starter Pack",
    description: "x",
    priceCents: 499,
    currency: "usd",
    stripePriceId: null,
    active: true,
    _count: { songs: 2 },
  },
  {
    id: "p2",
    slug: "pro",
    name: "Pro Pack",
    description: null,
    priceCents: 999,
    currency: "usd",
    stripePriceId: "price_123",
    active: true,
    _count: { songs: 5 },
  },
];

// Stub returns pack data; entitlements report ownership of p2 only.
const prisma = {
  songPack: {
    findMany: async () => PACKS,
    findUnique: async ({ where }: { where: { id: string } }) =>
      PACKS.find((p) => p.id === where.id) ?? null,
  },
  entitlement: {
    findMany: async () => [{ packId: "p2" }],
    findUnique: async () => null,
  },
} as unknown as PrismaClient;

function buildApp() {
  const app = express();
  app.post(
    "/store/webhook",
    express.raw({ type: "application/json" }),
    storeWebhookHandler(prisma)
  );
  app.use(express.json());
  app.use("/store", storeRouter(prisma));
  return app;
}

let app: express.Express;

beforeAll(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.NODE_ENV;
  process.env.AUTH_DEV_BYPASS = "true";
  app = buildApp();
});

describe("GET /store/packs", () => {
  it("lists active packs with owned flags for an authenticated caller", async () => {
    const res = await request(app)
      .get("/store/packs")
      .set("x-player-id", VALID_UUID);
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.packs.map((p: any) => [p.id, p]));
    expect(byId.p1).toMatchObject({ purchasable: false, owned: false, songCount: 2 });
    expect(byId.p2).toMatchObject({ purchasable: true, owned: true, songCount: 5 });
  });

  it("returns owned=false for an anonymous caller", async () => {
    const res = await request(app).get("/store/packs");
    expect(res.status).toBe(200);
    expect(res.body.packs.every((p: any) => p.owned === false)).toBe(true);
  });
});

describe("POST /store/checkout", () => {
  it("returns 503 when Stripe is not configured", async () => {
    const res = await request(app)
      .post("/store/checkout")
      .set("x-player-id", VALID_UUID)
      .send({ packId: "p2" });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/payments not configured/i);
  });
});

describe("POST /store/webhook", () => {
  it("returns 503 when the webhook secret is not configured", async () => {
    const res = await request(app)
      .post("/store/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "checkout.session.completed" }));
    expect(res.status).toBe(503);
  });
});
