import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { cosmeticsRouter } from "./cosmetics.js";
import { equipCosmetic } from "../lib/cosmetics.js";

const PID = "550e8400-e29b-41d4-a716-446655440000";

function buildApp(prisma: PrismaClient) {
  const app = express();
  app.use(express.json());
  app.use("/cosmetics", cosmeticsRouter(prisma));
  return app;
}

beforeEach(() => {
  process.env.AUTH_DEV_BYPASS = "true";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.STRIPE_SECRET_KEY;
});

describe("GET /cosmetics", () => {
  it("lists active items with owned/equipped for the caller", async () => {
    const prisma = {
      cosmeticItem: {
        findMany: async () => [
          { id: "c1", slug: "frame-gold", name: "Gold", description: null, category: "frame", priceCents: 299, currency: "usd", stripePriceId: "price_1" },
          { id: "c2", slug: "title-pro", name: "Pro", description: null, category: "title", priceCents: 199, currency: "usd", stripePriceId: null },
        ],
      },
      cosmeticOwnership: {
        findMany: async ({ select }: any) =>
          select?.cosmeticItemId
            ? [{ cosmeticItemId: "c1" }] // owned + (equipped query also returns this)
            : [],
      },
    } as unknown as PrismaClient;

    const res = await request(buildApp(prisma)).get("/cosmetics").set("x-player-id", PID);
    expect(res.status).toBe(200);
    const c1 = res.body.cosmetics.find((c: any) => c.id === "c1");
    expect(c1).toMatchObject({ purchasable: true, owned: true });
    const c2 = res.body.cosmetics.find((c: any) => c.id === "c2");
    expect(c2.purchasable).toBe(false); // no stripePriceId
  });
});

describe("POST /cosmetics/checkout", () => {
  it("503s when Stripe is not configured", async () => {
    const res = await request(buildApp({} as PrismaClient))
      .post("/cosmetics/checkout")
      .set("x-player-id", PID)
      .send({ cosmeticItemId: "c1" });
    expect(res.status).toBe(503);
  });
});

describe("POST /cosmetics/equip", () => {
  it("403s when the player does not own the item", async () => {
    const prisma = {
      cosmeticOwnership: { findUnique: async () => null },
    } as unknown as PrismaClient;
    const res = await request(buildApp(prisma))
      .post("/cosmetics/equip")
      .set("x-player-id", PID)
      .send({ cosmeticItemId: "c1" });
    expect(res.status).toBe(403);
  });

  it("equips an owned item", async () => {
    const prisma = {
      cosmeticOwnership: {
        findUnique: async () => ({ id: "own-1", item: { category: "frame" } }),
        findMany: async () => [],
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: async (ops: unknown[]) => Promise.all(ops),
    } as unknown as PrismaClient;
    const res = await request(buildApp(prisma))
      .post("/cosmetics/equip")
      .set("x-player-id", PID)
      .send({ cosmeticItemId: "c1" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ equipped: "c1", category: "frame" });
  });
});

describe("equipCosmetic (lib)", () => {
  it("unequips other owned items in the same category", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      cosmeticOwnership: {
        findUnique: async () => ({ id: "own-2", item: { category: "frame" } }),
        findMany: async () => [
          { id: "own-1", item: { category: "frame" } }, // currently equipped frame
          { id: "own-9", item: { category: "title" } }, // different category, untouched
        ],
        update,
        updateMany,
      },
      $transaction: async (ops: unknown[]) => Promise.all(ops),
    } as unknown as PrismaClient;

    const result = await equipCosmetic(prisma, PID, "c-frame-2");
    expect(result).toEqual({ ok: true, category: "frame" });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["own-1"] } },
      data: { equipped: false },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: "own-2" }, data: { equipped: true } });
  });

  it("returns not_owned when the player lacks the item", async () => {
    const prisma = {
      cosmeticOwnership: { findUnique: async () => null },
    } as unknown as PrismaClient;
    expect(await equipCosmetic(prisma, PID, "nope")).toEqual({ ok: false, reason: "not_owned" });
  });
});
