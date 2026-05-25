"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/** VoxArena API */
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const redis_js_1 = require("./lib/redis.js");
const songs_js_1 = require("./routes/songs.js");
const players_js_1 = require("./routes/players.js");
const performances_js_1 = require("./routes/performances.js");
const supabase_js_1 = require("./lib/supabase.js");
const matchmaking_js_1 = require("./routes/matchmaking.js");
const botDuel_js_1 = require("./routes/botDuel.js");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT ?? 3000;
app.use(express_1.default.json());
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
    }
    catch (e) {
        res.status(503).json({ ok: false, error: String(e) });
    }
});
app.get("/health/redis", async (_req, res) => {
    const result = await (0, redis_js_1.redisPing)();
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
    const client = (0, supabase_js_1.getSupabaseAdmin)();
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
app.use("/songs", (0, songs_js_1.songsRouter)(prisma));
app.use("/players", (0, players_js_1.playersRouter)(prisma));
app.use("/performances", (0, performances_js_1.performancesRouter)(prisma));
app.use("/leaderboard", (0, performances_js_1.leaderboardRouter)(prisma));
app.use("/matchmaking", (0, matchmaking_js_1.matchmakingRouter)(prisma));
app.use("/bot", (0, botDuel_js_1.botDuelRouter)(prisma));
async function main() {
    app.listen(PORT, () => {
        console.log(`VoxArena API listening on http://localhost:${PORT}`);
        console.log("  GET  /health /health/db /health/redis /health/supabase /health/resend");
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
