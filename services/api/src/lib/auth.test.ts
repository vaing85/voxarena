import { describe, it, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { requireAuth, actingPlayerId, authEnabled } from "./auth.js";

const SECRET = "test-secret";
const PLAYER_ID = "11111111-1111-4111-8111-111111111111";

function fakeRes() {
  const out = { code: 200 as number, body: null as unknown };
  const res = {
    status(c: number) {
      out.code = c;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
    _out: out,
  };
  return res;
}

function stubPrisma() {
  const created: { supabaseUserId: string; email?: string }[] = [];
  return {
    created,
    player: {
      async findUnique({ where }: { where: { supabaseUserId: string } }) {
        const p = created.find((c) => c.supabaseUserId === where.supabaseUserId);
        return p ? { id: PLAYER_ID, ...p } : null;
      },
      async create({ data }: { data: { supabaseUserId: string; email?: string } }) {
        created.push(data);
        return { id: PLAYER_ID, ...data };
      },
    },
  };
}

// eslint cast helper — middleware only touches headers + the player model.
function run(prisma: ReturnType<typeof stubPrisma>) {
  return requireAuth(prisma as never);
}

afterEach(() => {
  delete process.env.SUPABASE_JWT_SECRET;
});

describe("auth disabled (no secret)", () => {
  beforeEach(() => {
    delete process.env.SUPABASE_JWT_SECRET;
  });

  it("is a no-op that calls next and sets no auth", async () => {
    const req = { headers: {} } as never as { auth?: unknown };
    let nexted = false;
    await run(stubPrisma())(req as never, fakeRes() as never, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    expect(req.auth).toBeUndefined();
    expect(authEnabled()).toBe(false);
  });

  it("actingPlayerId falls back to the supplied id", () => {
    expect(actingPlayerId({}, "body-id")).toBe("body-id");
    expect(actingPlayerId({}, 123)).toBeUndefined();
  });
});

describe("auth enabled (secret set)", () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = SECRET;
  });

  it("accepts a valid token and find-or-creates the player", async () => {
    const token = jwt.sign({ sub: "sub-abc", email: "a@b.com" }, SECRET, {
      algorithm: "HS256",
    });
    const req = { headers: { authorization: `Bearer ${token}` } } as never as {
      auth?: { playerId: string; supabaseUserId: string };
    };
    let nexted = false;
    const prisma = stubPrisma();
    await run(prisma)(req as never, fakeRes() as never, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    expect(req.auth?.playerId).toBe(PLAYER_ID);
    expect(req.auth?.supabaseUserId).toBe("sub-abc");
    expect(authEnabled()).toBe(true);
    expect(actingPlayerId(req, "spoofed-id")).toBe(PLAYER_ID);
  });

  it("reuses an existing player without creating a duplicate", async () => {
    const token = jwt.sign({ sub: "sub-abc" }, SECRET, { algorithm: "HS256" });
    const prisma = stubPrisma();
    const mw = run(prisma);
    await mw({ headers: { authorization: `Bearer ${token}` } } as never, fakeRes() as never, () => {});
    await mw({ headers: { authorization: `Bearer ${token}` } } as never, fakeRes() as never, () => {});
    expect(prisma.created.length).toBe(1);
  });

  it("rejects a missing token with 401", async () => {
    const res = fakeRes();
    let nexted = false;
    await run(stubPrisma())({ headers: {} } as never, res as never, () => {
      nexted = true;
    });
    expect(res._out.code).toBe(401);
    expect(nexted).toBe(false);
  });

  it("rejects a bad signature with 401", async () => {
    const token = jwt.sign({ sub: "x" }, "WRONG-secret", { algorithm: "HS256" });
    const res = fakeRes();
    await run(stubPrisma())(
      { headers: { authorization: `Bearer ${token}` } } as never,
      res as never,
      () => {}
    );
    expect(res._out.code).toBe(401);
  });
});
