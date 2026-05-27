import type { PrismaClient } from "@prisma/client";
import { emitCosmeticGranted } from "./events.js";

/** Cosmetic item ids a player owns, as a Set for cheap membership checks. */
export async function ownedCosmeticIds(
  prisma: PrismaClient,
  playerId: string
): Promise<Set<string>> {
  const rows = await prisma.cosmeticOwnership.findMany({
    where: { playerId },
    select: { cosmeticItemId: true },
  });
  return new Set(rows.map((r) => r.cosmeticItemId));
}

/**
 * Idempotently grant a cosmetic from a completed Stripe Checkout Session.
 * The (playerId, cosmeticItemId) unique makes repeated webhook deliveries safe.
 */
export async function grantCosmeticFromSession(
  prisma: PrismaClient,
  session: {
    id?: string | null;
    metadata?: { playerId?: string | null; cosmeticItemId?: string | null } | null;
  }
): Promise<{ granted: boolean; reason?: string }> {
  const playerId = session.metadata?.playerId ?? undefined;
  const cosmeticItemId = session.metadata?.cosmeticItemId ?? undefined;
  if (!playerId || !cosmeticItemId) {
    return { granted: false, reason: "missing_metadata" };
  }

  await prisma.cosmeticOwnership.upsert({
    where: { playerId_cosmeticItemId: { playerId, cosmeticItemId } },
    update: {},
    create: {
      playerId,
      cosmeticItemId,
      source: "purchase",
      stripeSessionId: session.id ?? undefined,
    },
  });
  void emitCosmeticGranted({
    playerId,
    cosmeticItemId,
    source: "purchase",
    stripeSessionId: session.id ?? null,
  });
  return { granted: true };
}

/**
 * Equip an owned cosmetic, unequipping any other owned item in the same
 * category (at most one equipped per category).
 */
export async function equipCosmetic(
  prisma: PrismaClient,
  playerId: string,
  cosmeticItemId: string
): Promise<{ ok: true; category: string } | { ok: false; reason: "not_owned" }> {
  const ownership = await prisma.cosmeticOwnership.findUnique({
    where: { playerId_cosmeticItemId: { playerId, cosmeticItemId } },
    include: { item: { select: { category: true } } },
  });
  if (!ownership) return { ok: false, reason: "not_owned" };

  const category = ownership.item.category;
  const owned = await prisma.cosmeticOwnership.findMany({
    where: { playerId, equipped: true },
    include: { item: { select: { category: true } } },
  });
  const toUnequip = owned
    .filter((o) => o.item.category === category && o.id !== ownership.id)
    .map((o) => o.id);

  await prisma.$transaction([
    prisma.cosmeticOwnership.updateMany({
      where: { id: { in: toUnequip } },
      data: { equipped: false },
    }),
    prisma.cosmeticOwnership.update({
      where: { id: ownership.id },
      data: { equipped: true },
    }),
  ]);
  return { ok: true, category };
}
