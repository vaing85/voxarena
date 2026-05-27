import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { adminRouter } from "./admin.js";

function buildApp(prisma: PrismaClient) {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter(prisma));
  return app;
}

beforeEach(() => {
  delete process.env.ADMIN_TOKEN;
});

describe("admin auth", () => {
  it("503s when ADMIN_TOKEN is not configured", async () => {
    const res = await request(buildApp({} as PrismaClient)).get("/admin/flags");
    expect(res.status).toBe(503);
  });

  it("401s on a wrong token", async () => {
    process.env.ADMIN_TOKEN = "secret";
    const res = await request(buildApp({} as PrismaClient))
      .get("/admin/flags")
      .set("x-admin-token", "nope");
    expect(res.status).toBe(401);
  });
});

describe("GET /admin/flags", () => {
  it("lists open flags by default", async () => {
    process.env.ADMIN_TOKEN = "secret";
    const findMany = vi.fn().mockResolvedValue([{ id: "f1", reason: "score_mismatch", status: "open" }]);
    const prisma = { cheatFlag: { findMany } } as unknown as PrismaClient;
    const res = await request(buildApp(prisma)).get("/admin/flags").set("x-admin-token", "secret");
    expect(res.status).toBe(200);
    expect(res.body.flags).toHaveLength(1);
    expect(findMany.mock.calls[0][0].where).toEqual({ status: "open" });
  });

  it("status=all queries without a status filter", async () => {
    process.env.ADMIN_TOKEN = "secret";
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { cheatFlag: { findMany } } as unknown as PrismaClient;
    await request(buildApp(prisma)).get("/admin/flags?status=all").set("x-admin-token", "secret");
    expect(findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("POST /admin/flags/:id/resolve", () => {
  it("rejects an invalid status", async () => {
    process.env.ADMIN_TOKEN = "secret";
    const res = await request(buildApp({} as PrismaClient))
      .post("/admin/flags/f1/resolve")
      .set("x-admin-token", "secret")
      .send({ status: "banned" });
    expect(res.status).toBe(400);
  });

  it("marks a flag reviewed", async () => {
    process.env.ADMIN_TOKEN = "secret";
    const update = vi.fn().mockResolvedValue({ id: "f1", status: "reviewed" });
    const prisma = { cheatFlag: { update } } as unknown as PrismaClient;
    const res = await request(buildApp(prisma))
      .post("/admin/flags/f1/resolve")
      .set("x-admin-token", "secret")
      .send({ status: "reviewed" });
    expect(res.status).toBe(200);
    expect(res.body.flag.status).toBe("reviewed");
    expect(update.mock.calls[0][0].data.status).toBe("reviewed");
  });
});
