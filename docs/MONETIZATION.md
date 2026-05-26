# VoxArena — Monetization (Clean, Non-Predatory)

Monetization that doesn’t affect competitive fairness.

---

## Allowed (no pay-to-win in ranked)

| Item | Description |
|------|-------------|
| **Song packs** | New songs / catalogs; same scoring for everyone. |
| **Voice skins / stage FX** | Cosmetic only (reverb, visual stage, avatar); no impact on score. |
| **Ranked season passes** | Access to ranked rewards, cosmetics, or exclusive tournaments; no MMR/score advantage. |
| **Tournament entries** | Paid entry to brackets with prize pools; same rules and scoring for all. |

---

## Not allowed (fairness)

- **No score boosts** in ranked (no items that change pitch/timing/quality weights).
- **No “premium” difficulty** that gives more MMR per win.
- **No paywall on core ranked ladder** — free players can climb; season pass = rewards/cosmetics, not access to rank.

---

## Summary

- **Songs + cosmetics + season passes + tournament entries** = yes.
- **Anything that changes competitive outcome for pay** = no.

This keeps the game fair while giving clear, ethical revenue streams.

---

## Implemented: song packs (Stripe)

The first revenue stream is wired end to end (Stripe IDs/keys come from env — no
products are created in any live account by the code):

| Piece | Where |
|-------|-------|
| **Model** | `SongPack` (slug, price, `stripePriceId`, active) and `Entitlement` (`@@unique([playerId, packId])`); `Song.packId` locks a song to a pack (null = free). |
| **Browse** | `GET /store/packs` — active packs with `songCount`, `purchasable`, and `owned` (when authenticated). |
| **Buy** | `POST /store/checkout` (auth) — creates a Stripe Checkout Session for the pack's `stripePriceId`, returns `{ url }`. `503` if Stripe unset; `409` if not yet purchasable or already owned. |
| **Fulfilment** | `POST /store/webhook` — signature-verified; on `checkout.session.completed` it grants the entitlement idempotently (keyed on the session id + the player/pack unique). |
| **Enforcement** | Playing a song (`POST /performances`, `POST /bot/solo-vs-bot`) returns `403` if the song is locked and unowned. Cosmetic/fairness: packs add **content only**, never scoring weights. |

**To go live:** create a Stripe Product + Price for each pack, set `stripePriceId`
on the `SongPack` row, set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`, and point
a Stripe webhook at `POST /store/webhook`.

**Next streams:** cosmetics / voice skins, season passes, tournament entries.
