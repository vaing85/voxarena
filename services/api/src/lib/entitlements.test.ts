import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  canPlaySong,
  ownedPackIds,
  grantEntitlementFromSession,
} from "./entitlements.js";

function fakePrisma(entitlement: Record<string, unknown>): PrismaClient {
  return { entitlement } as unknown as PrismaClient;
}

describe("canPlaySong", () => {
  it("allows a free song without hitting the DB", async () => {
    const findUnique = vi.fn();
    const prisma = fakePrisma({ findUnique });
    expect(await canPlaySong(prisma, "player-1", { packId: null })).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("blocks a locked song the player does not own", async () => {
    const prisma = fakePrisma({ findUnique: vi.fn().mockResolvedValue(null) });
    expect(await canPlaySong(prisma, "player-1", { packId: "pack-1" })).toBe(false);
  });

  it("allows a locked song the player owns", async () => {
    const prisma = fakePrisma({
      findUnique: vi.fn().mockResolvedValue({ id: "ent-1" }),
    });
    expect(await canPlaySong(prisma, "player-1", { packId: "pack-1" })).toBe(true);
  });
});

describe("ownedPackIds", () => {
  it("returns the player's pack ids as a Set", async () => {
    const prisma = fakePrisma({
      findMany: vi
        .fn()
        .mockResolvedValue([{ packId: "a" }, { packId: "b" }]),
    });
    const owned = await ownedPackIds(prisma, "player-1");
    expect(owned).toEqual(new Set(["a", "b"]));
  });
});

describe("grantEntitlementFromSession", () => {
  it("does nothing when metadata is missing", async () => {
    const upsert = vi.fn();
    const prisma = fakePrisma({ upsert });
    const result = await grantEntitlementFromSession(prisma, {
      id: "cs_1",
      metadata: {},
    });
    expect(result).toEqual({ granted: false, reason: "missing_metadata" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts an entitlement keyed on (playerId, packId) for idempotency", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = fakePrisma({ upsert });
    const result = await grantEntitlementFromSession(prisma, {
      id: "cs_123",
      metadata: { playerId: "player-1", packId: "pack-1" },
    });
    expect(result).toEqual({ granted: true });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerId_packId: { playerId: "player-1", packId: "pack-1" } },
        create: expect.objectContaining({
          playerId: "player-1",
          packId: "pack-1",
          source: "purchase",
          stripeSessionId: "cs_123",
        }),
      })
    );
  });
});
