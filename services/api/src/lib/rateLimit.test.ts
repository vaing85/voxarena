import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { rateLimit } from "./rateLimit.js";

function appWith(max: number) {
  const app = express();
  app.use(rateLimit({ windowMs: 60_000, max }));
  app.get("/x", (_req, res) => res.json({ ok: true }));
  return app;
}

beforeEach(() => {
  delete process.env.RATE_LIMIT_DISABLED;
});

describe("rateLimit", () => {
  it("allows requests up to the limit, then 429s", async () => {
    const app = appWith(2);
    const a = await request(app).get("/x");
    const b = await request(app).get("/x");
    const c = await request(app).get("/x");
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(c.status).toBe(429);
    expect(c.body.error).toMatch(/too many/i);
    expect(c.headers["retry-after"]).toBeDefined();
  });

  it("sets limit/remaining headers", async () => {
    const res = await request(appWith(5)).get("/x");
    expect(res.headers["x-ratelimit-limit"]).toBe("5");
    expect(res.headers["x-ratelimit-remaining"]).toBe("4");
  });

  it("is a no-op when disabled", async () => {
    process.env.RATE_LIMIT_DISABLED = "true";
    const app = appWith(1);
    await request(app).get("/x");
    const second = await request(app).get("/x");
    expect(second.status).toBe(200); // would be 429 if enabled
  });
});
