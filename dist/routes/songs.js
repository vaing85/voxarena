"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.songsRouter = songsRouter;
const express_1 = require("express");
const ids_js_1 = require("../lib/ids.js");
function songsRouter(prisma) {
    const r = (0, express_1.Router)();
    r.get("/", async (_req, res) => {
        const songs = await prisma.song.findMany({
            orderBy: { title: "asc" },
            select: {
                id: true,
                title: true,
                artist: true,
                difficulty: true,
                referenceId: true,
                createdAt: true,
            },
        });
        res.json({ songs });
    });
    r.get("/:id", async (req, res) => {
        const { id } = req.params;
        if (!(0, ids_js_1.isUuidString)(id)) {
            res.status(400).json({ error: "Invalid song id" });
            return;
        }
        const song = await prisma.song.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                artist: true,
                difficulty: true,
                referenceId: true,
                createdAt: true,
            },
        });
        if (!song) {
            res.status(404).json({ error: "Song not found" });
            return;
        }
        res.json(song);
    });
    return r;
}
