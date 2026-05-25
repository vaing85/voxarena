"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playersRouter = playersRouter;
const express_1 = require("express");
/** Phase 1: create a player without auth (for local testing). */
function playersRouter(prisma) {
    const r = (0, express_1.Router)();
    r.post("/", async (req, res) => {
        const name = typeof req.body?.name === "string" && req.body.name.trim()
            ? req.body.name.trim().slice(0, 64)
            : "Player";
        const player = await prisma.player.create({
            data: { name },
            select: {
                id: true,
                name: true,
                mmr: true,
                tier: true,
                createdAt: true,
            },
        });
        res.status(201).json(player);
    });
    return r;
}
