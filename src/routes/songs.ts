import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { isUuidString } from "../lib/ids.js";

export function songsRouter(prisma: PrismaClient): Router {
  const r = Router();

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
    if (!isUuidString(id)) {
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
