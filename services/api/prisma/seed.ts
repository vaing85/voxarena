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

  // Demo song (find-or-create so re-seeding doesn't duplicate).
  let song = await prisma.song.findFirst({ where: { title: "Demo Song" } });
  if (!song) {
    song = await prisma.song.create({
      data: { title: "Demo Song", artist: "VoxArena", difficulty: "easy" },
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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
