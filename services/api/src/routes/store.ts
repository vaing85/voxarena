import { Router, type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { authenticate, requireAuth } from "../lib/auth.js";
import { getStripe, isStripeConfigured } from "../lib/stripe.js";
import {
  grantEntitlementFromSession,
  ownedPackIds,
} from "../lib/entitlements.js";

export function storeRouter(prisma: PrismaClient): Router {
  const r = Router();

  /**
   * List purchasable song packs. Public, but if the caller is authenticated
   * each pack includes an `owned` flag.
   */
  r.get("/packs", async (req, res) => {
    const auth = await authenticate(prisma, req);
    const owned = auth.ok
      ? await ownedPackIds(prisma, auth.player.id)
      : new Set<string>();

    const packs = await prisma.songPack.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { songs: true } } },
    });

    res.json({
      packs: packs.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        currency: p.currency,
        songCount: p._count.songs,
        purchasable: Boolean(p.stripePriceId),
        owned: owned.has(p.id),
      })),
    });
  });

  /** Start a Stripe Checkout session for a pack. */
  r.post("/checkout", requireAuth(prisma), async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: "Payments not configured (STRIPE_SECRET_KEY)" });
      return;
    }

    const { packId } = req.body ?? {};
    if (typeof packId !== "string" || !packId) {
      res.status(400).json({ error: "packId is required" });
      return;
    }

    const pack = await prisma.songPack.findUnique({ where: { id: packId } });
    if (!pack || !pack.active) {
      res.status(404).json({ error: "Pack not found" });
      return;
    }
    if (!pack.stripePriceId) {
      res.status(409).json({ error: "Pack is not purchasable yet (no Stripe price configured)" });
      return;
    }

    const playerId = req.player!.id;
    const already = await prisma.entitlement.findUnique({
      where: { playerId_packId: { playerId, packId: pack.id } },
    });
    if (already) {
      res.status(409).json({ error: "You already own this pack" });
      return;
    }

    const base = process.env.CHECKOUT_BASE_URL ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: pack.stripePriceId, quantity: 1 }],
      success_url: `${base}/?purchase=success`,
      cancel_url: `${base}/?purchase=cancel`,
      client_reference_id: playerId,
      metadata: { playerId, packId: pack.id },
    });

    res.status(201).json({ url: session.url, sessionId: session.id });
  });

  return r;
}

/**
 * Stripe webhook. Mounted with a raw body parser (signature verification needs
 * the unparsed payload), so it lives outside the JSON router.
 */
export function storeWebhookHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    const stripe = getStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripe || !secret) {
      res.status(503).json({ error: "Webhook not configured" });
      return;
    }

    const signature = req.header("stripe-signature");
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature ?? "", secret);
    } catch {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id?: string;
        metadata?: { playerId?: string; packId?: string } | null;
      };
      const result = await grantEntitlementFromSession(prisma, session);
      if (!result.granted) {
        console.warn("Stripe webhook: entitlement not granted —", result.reason);
      }
    }

    res.json({ received: true });
  };
}

export function isPaymentsConfigured(): boolean {
  return isStripeConfigured();
}
