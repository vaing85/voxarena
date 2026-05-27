import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { authenticate, requireAuth } from "../lib/auth.js";
import { getStripe } from "../lib/stripe.js";
import { equipCosmetic, ownedCosmeticIds } from "../lib/cosmetics.js";

export function cosmeticsRouter(prisma: PrismaClient): Router {
  const r = Router();

  /**
   * List active cosmetic items. Public, but when authenticated each item
   * includes `owned` and `equipped` flags for the caller.
   */
  r.get("/", async (req, res) => {
    const auth = await authenticate(prisma, req);
    const playerId = auth.ok ? auth.player.id : null;

    const [items, equippedIds, ownedIds] = await Promise.all([
      prisma.cosmeticItem.findMany({
        where: { active: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      playerId
        ? prisma.cosmeticOwnership
            .findMany({ where: { playerId, equipped: true }, select: { cosmeticItemId: true } })
            .then((rows) => new Set(rows.map((x) => x.cosmeticItemId)))
        : Promise.resolve(new Set<string>()),
      playerId ? ownedCosmeticIds(prisma, playerId) : Promise.resolve(new Set<string>()),
    ]);

    res.json({
      cosmetics: items.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        category: c.category,
        priceCents: c.priceCents,
        currency: c.currency,
        purchasable: Boolean(c.stripePriceId),
        owned: ownedIds.has(c.id),
        equipped: equippedIds.has(c.id),
      })),
    });
  });

  /** Start a Stripe Checkout session for a cosmetic item. */
  r.post("/checkout", requireAuth(prisma), async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payments not configured (STRIPE_SECRET_KEY)" });
      return;
    }
    const { cosmeticItemId } = req.body ?? {};
    if (typeof cosmeticItemId !== "string" || !cosmeticItemId) {
      res.status(400).json({ error: "cosmeticItemId is required" });
      return;
    }

    const item = await prisma.cosmeticItem.findUnique({ where: { id: cosmeticItemId } });
    if (!item || !item.active) {
      res.status(404).json({ error: "Cosmetic not found" });
      return;
    }
    if (!item.stripePriceId) {
      res.status(409).json({ error: "Cosmetic is not purchasable yet (no Stripe price configured)" });
      return;
    }

    const playerId = req.player!.id;
    const already = await prisma.cosmeticOwnership.findUnique({
      where: { playerId_cosmeticItemId: { playerId, cosmeticItemId: item.id } },
    });
    if (already) {
      res.status(409).json({ error: "You already own this cosmetic" });
      return;
    }

    const base = process.env.CHECKOUT_BASE_URL ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: item.stripePriceId, quantity: 1 }],
      success_url: `${base}/?purchase=success`,
      cancel_url: `${base}/?purchase=cancel`,
      client_reference_id: playerId,
      metadata: { playerId, cosmeticItemId: item.id },
    });
    res.status(201).json({ url: session.url, sessionId: session.id });
  });

  /** Equip an owned cosmetic (unequips any other owned item in its category). */
  r.post("/equip", requireAuth(prisma), async (req, res) => {
    const { cosmeticItemId } = req.body ?? {};
    if (typeof cosmeticItemId !== "string" || !cosmeticItemId) {
      res.status(400).json({ error: "cosmeticItemId is required" });
      return;
    }
    const result = await equipCosmetic(prisma, req.player!.id, cosmeticItemId);
    if (!result.ok) {
      res.status(403).json({ error: "You do not own this cosmetic" });
      return;
    }
    res.json({ equipped: cosmeticItemId, category: result.category });
  });

  /** Unequip an owned cosmetic. */
  r.post("/unequip", requireAuth(prisma), async (req, res) => {
    const { cosmeticItemId } = req.body ?? {};
    if (typeof cosmeticItemId !== "string" || !cosmeticItemId) {
      res.status(400).json({ error: "cosmeticItemId is required" });
      return;
    }
    const { count } = await prisma.cosmeticOwnership.updateMany({
      where: { playerId: req.player!.id, cosmeticItemId, equipped: true },
      data: { equipped: false },
    });
    res.json({ unequipped: count > 0 });
  });

  return r;
}
