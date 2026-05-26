import type { PrismaClient } from "@prisma/client";

/** A song is playable if it is free (no pack) or the player owns its pack. */
export async function canPlaySong(
  prisma: PrismaClient,
  playerId: string,
  song: { packId: string | null }
): Promise<boolean> {
  if (!song.packId) return true;
  const entitlement = await prisma.entitlement.findUnique({
    where: { playerId_packId: { playerId, packId: song.packId } },
  });
  return entitlement !== null;
}

/** Pack ids a player owns, as a Set for cheap membership checks. */
export async function ownedPackIds(
  prisma: PrismaClient,
  playerId: string
): Promise<Set<string>> {
  const rows = await prisma.entitlement.findMany({
    where: { playerId },
    select: { packId: true },
  });
  return new Set(rows.map((r) => r.packId));
}

/**
 * Idempotently grant a pack from a completed Stripe Checkout Session.
 * The composite (playerId, packId) unique makes repeated webhook deliveries safe.
 * Returns the action taken (for logging / tests).
 */
export async function grantEntitlementFromSession(
  prisma: PrismaClient,
  session: {
    id?: string | null;
    metadata?: { playerId?: string | null; packId?: string | null } | null;
  }
): Promise<{ granted: boolean; reason?: string }> {
  const playerId = session.metadata?.playerId ?? undefined;
  const packId = session.metadata?.packId ?? undefined;
  if (!playerId || !packId) {
    return { granted: false, reason: "missing_metadata" };
  }

  await prisma.entitlement.upsert({
    where: { playerId_packId: { playerId, packId } },
    update: {},
    create: {
      playerId,
      packId,
      source: "purchase",
      stripeSessionId: session.id ?? undefined,
    },
  });
  return { granted: true };
}
