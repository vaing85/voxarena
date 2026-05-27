/** VoxArena — seed: demo song, demo player, and house bot. Run: npm run db:seed */
import { PrismaClient } from "@prisma/client";
import { HOUSE_BOT_DEVICE_ID } from "../src/config.js";

const prisma = new PrismaClient();

async function main() {
  // House bot — opponent for /bot/solo-vs-bot; excluded from leaderboards.
  let houseBot = await prisma.player.findFirst({
    where: { deviceId: HOUSE_BOT_DEVICE_ID },
  });
  if (!houseBot) {
    houseBot = await prisma.player.create({
      data: { name: "VoxArena Bot", deviceId: HOUSE_BOT_DEVICE_ID },
    });
  }

  // A short reference melody (C4 D4 E4 F4) for pitch/timing scoring demos.
  // Starts after a brief lead-in so the first note's onset is detectable.
  const referenceNotes = [
    { start: 0.3, end: 0.8, midi: 60 },
    { start: 0.8, end: 1.3, midi: 62 },
    { start: 1.3, end: 1.8, midi: 64 },
    { start: 1.8, end: 2.3, midi: 65 },
  ];

  // Demo song (find-or-create so re-seeding doesn't duplicate). Free for all.
  let song = await prisma.song.findFirst({ where: { title: "Demo Song" } });
  if (!song) {
    song = await prisma.song.create({
      data: {
        title: "Demo Song",
        artist: "VoxArena",
        difficulty: "easy",
        referenceNotes,
      },
    });
  } else if (song.referenceNotes == null) {
    song = await prisma.song.update({
      where: { id: song.id },
      data: { referenceNotes },
    });
  }

  // Starter song pack (monetization demo) + a song locked behind it.
  let pack = await prisma.songPack.findUnique({ where: { slug: "starter-pack" } });
  if (!pack) {
    pack = await prisma.songPack.create({
      data: {
        slug: "starter-pack",
        name: "Starter Pack",
        description: "A few extra songs to get you going.",
        priceCents: 499,
        currency: "usd",
        // stripePriceId left null until a real Stripe price is wired (price_...).
      },
    });
  }

  const packedSong = await prisma.song.findFirst({ where: { title: "Encore" } });
  if (!packedSong) {
    await prisma.song.create({
      data: { title: "Encore", artist: "VoxArena", difficulty: "medium", packId: pack.id },
    });
  }

  // Demo cosmetic items (one per category). No Stripe price yet, so they show
  // in the catalog but aren't purchasable until a price is wired (like packs).
  const cosmetics = [
    { slug: "frame-gold", name: "Gold Frame", category: "frame", priceCents: 299 },
    { slug: "frame-neon", name: "Neon Frame", category: "frame", priceCents: 299 },
    { slug: "title-virtuoso", name: "Virtuoso", category: "title", priceCents: 199 },
    { slug: "color-sunset", name: "Sunset Name", category: "color", priceCents: 149 },
  ];
  for (const c of cosmetics) {
    await prisma.cosmeticItem.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }

  // Demo player.
  let player = await prisma.player.findFirst({ where: { name: "Demo Player" } });
  if (!player) {
    player = await prisma.player.create({ data: { name: "Demo Player" } });
  }

  console.log("Seed complete.");
  console.log(`SONG_ID=${song.id}`);
  console.log(`PLAYER_ID=${player.id}`);
  console.log(`PACK_ID=${pack.id} (slug: starter-pack — locks "Encore")`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
