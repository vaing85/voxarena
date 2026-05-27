/** VoxArena API */
import express, { type ErrorRequestHandler } from "express";
import "express-async-errors";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { Server as SocketServer } from "socket.io";
import { redisPing } from "./lib/redis.js";
import { setupLiveMatch } from "./realtime/liveMatch.js";
import { songsRouter } from "./routes/songs.js";
import { playersRouter } from "./routes/players.js";
import {
  performancesRouter,
  leaderboardRouter,
} from "./routes/performances.js";
import { getSupabaseAdmin } from "./lib/supabase.js";
import { matchmakingRouter } from "./routes/matchmaking.js";
import { botDuelRouter } from "./routes/botDuel.js";
import { storeRouter, storeWebhookHandler } from "./routes/store.js";
import { cosmeticsRouter } from "./routes/cosmetics.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT ?? 3000;

// Stripe webhook needs the raw body for signature verification, so it must be
// registered before the JSON body parser.
app.post(
  "/store/webhook",
  express.raw({ type: "application/json" }),
  storeWebhookHandler(prisma)
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "voxarena-api",
    phase: 2,
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.player.count();
    res.json({ ok: true, db: "postgresql" });
  } catch (e) {
    res.status(503).json({ ok: false, error: String(e) });
  }
});

app.get("/health/redis", async (_req, res) => {
  const result = await redisPing();
  if (result.ok) {
    res.json({ ok: true, redis: "connected" });
    return;
  }
  if (result.error === "REDIS_URL not set") {
    res.json({ ok: true, redis: "skipped", reason: "REDIS_URL not set" });
    return;
  }
  res.status(503).json({
    ok: false,
    redis: "unavailable",
    error: result.error,
  });
});

app.get("/health/supabase", (_req, res) => {
  const client = getSupabaseAdmin();
  if (!client) {
    res.json({
      ok: true,
      supabase: "skipped",
      reason: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set",
    });
    return;
  }
  res.json({ ok: true, supabase: "configured" });
});

app.get("/health/resend", (_req, res) => {
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  const hasFrom = Boolean(process.env.RESEND_FROM);
  if (!hasKey || !hasFrom) {
    res.json({
      ok: true,
      resend: "skipped",
      reason: "RESEND_API_KEY or RESEND_FROM not set",
    });
    return;
  }
  res.json({ ok: true, resend: "configured" });
});

app.use("/songs", songsRouter(prisma));
app.use("/players", playersRouter(prisma));
app.use("/performances", performancesRouter(prisma));
app.use("/leaderboard", leaderboardRouter(prisma));
app.use("/matchmaking", matchmakingRouter(prisma));
app.use("/bot", botDuelRouter(prisma));
app.use("/store", storeRouter(prisma));
app.use("/cosmetics", cosmeticsRouter(prisma));

// Optional static dev client. Served only when the directory is present (local
// dev / full-repo deploy); absent when the API is deployed from services/api alone.
const clientDir =
  process.env.CLIENT_DIR ?? path.resolve(__dirname, "../../../clients/web");
const clientAvailable = existsSync(path.join(clientDir, "index.html"));
if (clientAvailable) {
  app.use(express.static(clientDir));
}

// Catch errors thrown in any (sync or async) route handler so a failure
// returns 500 instead of crashing the process. Relies on express-async-errors
// to forward rejected promises here.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
};
app.use(errorHandler);

const httpServer = createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: "*" } });
setupLiveMatch(io, prisma);

async function main() {
  httpServer.listen(PORT, () => {
    console.log(`VoxArena API listening on http://localhost:${PORT}`);
    console.log(
      "  GET  /health /health/db /health/redis /health/supabase /health/resend"
    );
    console.log("  GET  /songs  GET /songs/:id");
    console.log("  POST /players");
    console.log("  POST /performances (optional matchId for ranked_pvp)");
    console.log("  GET  /leaderboard?songId=&limit=");
    console.log("  POST /matchmaking/ranked/join  POST /matchmaking/ranked/leave");
    console.log("  GET  /matchmaking/ranked/pending/:playerId");
    console.log("  GET  /bot/presets  POST /bot/solo-vs-bot");
    console.log("  GET  /store/packs  POST /store/checkout  POST /store/webhook");
    console.log("  GET  /cosmetics  POST /cosmetics/checkout /equip /unequip");
    console.log("  GET  /players/:id  /players/:id/performances  /players/:id/matches");
    console.log("  WS   live PvP (Socket.IO): match:join / match:progress / match:result");
    if (clientAvailable) {
      console.log(`  Web dev client at http://localhost:${PORT}/`);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
