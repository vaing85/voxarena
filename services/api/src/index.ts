/** VoxArena API */
import express, { type ErrorRequestHandler } from "express";
import "express-async-errors";
import { PrismaClient } from "@prisma/client";
import { redisPing } from "./lib/redis.js";
import { songsRouter } from "./routes/songs.js";
import { playersRouter } from "./routes/players.js";
import {
  performancesRouter,
  leaderboardRouter,
} from "./routes/performances.js";
import { getSupabaseAdmin } from "./lib/supabase.js";
import { matchmakingRouter } from "./routes/matchmaking.js";
import { botDuelRouter } from "./routes/botDuel.js";
import { requireAuth } from "./lib/auth.js";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT ?? 3000;

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
app.use("/performances", requireAuth(prisma), performancesRouter(prisma));
app.use("/leaderboard", leaderboardRouter(prisma));
app.use("/matchmaking", requireAuth(prisma), matchmakingRouter(prisma));
app.use("/bot", requireAuth(prisma), botDuelRouter(prisma));

// Catch errors thrown in any (sync or async) route handler so a failure
// returns 500 instead of crashing the process. Relies on express-async-errors
// to forward rejected promises here.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
};
app.use(errorHandler);

async function main() {
  app.listen(PORT, () => {
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
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
