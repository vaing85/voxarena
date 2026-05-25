import { describe, it, expect } from "vitest";
import { tryResolveAbandonedMatch } from "./rankedMatch.js";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const MATCH = "33333333-3333-4333-8333-333333333333";
const TWO_MIN = 2 * 60 * 1000;

type Player = { id: string; mmr: number; tier: string; matchesPlayed: number; matchesWon: number };
type Perf = { playerId: string; mode: string; scoreTotal: number | null };
type Match = {
  id: string;
  status: string;
  createdAt: Date;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  player1Score: number | null;
  player2Score: number | null;
  performances: Perf[];
};

function makeDb(opts: { ageMs: number; status?: string; perfs: Perf[] }) {
  const players = new Map<string, Player>([
    [P1, { id: P1, mmr: 1000, tier: "Bronze", matchesPlayed: 0, matchesWon: 0 }],
    [P2, { id: P2, mmr: 1000, tier: "Bronze", matchesPlayed: 0, matchesWon: 0 }],
  ]);
  const match: Match = {
    id: MATCH,
    status: opts.status ?? "pending",
    createdAt: new Date(Date.now() - opts.ageMs),
    player1Id: P1,
    player2Id: P2,
    winnerId: null,
    player1Score: null,
    player2Score: null,
    performances: opts.perfs,
  };

  const applyData = (target: Record<string, unknown>, data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in (v as object)) {
        target[k] = (target[k] as number) + (v as { increment: number }).increment;
      } else {
        target[k] = v;
      }
    }
  };

  const client = {
    match: {
      async findUnique({ where: { id } }: { where: { id: string } }) {
        return id === match.id ? match : null;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { id: string; status: string };
        data: Record<string, unknown>;
      }) {
        if (where.id === match.id && match.status === where.status) {
          applyData(match as unknown as Record<string, unknown>, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    player: {
      async findUnique({ where: { id } }: { where: { id: string } }) {
        return players.get(id) ?? null;
      },
      async update({ where: { id }, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const p = players.get(id)!;
        applyData(p as unknown as Record<string, unknown>, data);
        return p;
      },
    },
    async $transaction<T>(fn: (tx: typeof client) => Promise<T>): Promise<T> {
      return fn(client);
    },
  };

  return { players, match, prisma: client };
}

describe("tryResolveAbandonedMatch", () => {
  it("won't resolve before the timeout", async () => {
    const { prisma } = makeDb({ ageMs: 30_000, perfs: [{ playerId: P1, mode: "ranked_pvp", scoreTotal: 90 }] });
    const r = await tryResolveAbandonedMatch(prisma as never, MATCH);
    expect(r.resolved).toBe(false);
    if (!r.resolved) {
      expect(r.reason).toBe("not_expired");
      expect(r.retryInMs).toBeGreaterThan(0);
    }
  });

  it("awards a walkover (+penalty) when only one player submitted", async () => {
    const { prisma, players, match } = makeDb({
      ageMs: TWO_MIN + 1000,
      perfs: [{ playerId: P1, mode: "ranked_pvp", scoreTotal: 88 }],
    });
    const r = await tryResolveAbandonedMatch(prisma as never, MATCH);
    expect(r.resolved).toBe(true);
    if (r.resolved && r.outcome === "walkover") {
      expect(r.winnerId).toBe(P1);
      expect(r.loserId).toBe(P2);
    }
    expect(match.status).toBe("walkover");
    expect(match.winnerId).toBe(P1);
    // equal 1000/1000 → winner +16; loser -16 then -15 penalty = 969
    expect(players.get(P1)!.mmr).toBe(1016);
    expect(players.get(P2)!.mmr).toBe(969);
    expect(players.get(P1)!.matchesWon).toBe(1);
    expect(players.get(P2)!.matchesWon).toBe(0);
    expect(players.get(P1)!.matchesPlayed).toBe(1);
    expect(players.get(P2)!.matchesPlayed).toBe(1);
  });

  it("voids the match with no MMR change when neither submitted", async () => {
    const { prisma, players, match } = makeDb({ ageMs: TWO_MIN + 1000, perfs: [] });
    const r = await tryResolveAbandonedMatch(prisma as never, MATCH);
    expect(r.resolved).toBe(true);
    if (r.resolved) expect(r.outcome).toBe("void");
    expect(match.status).toBe("abandoned");
    expect(players.get(P1)!.mmr).toBe(1000);
    expect(players.get(P2)!.mmr).toBe(1000);
  });

  it("defers to normal finalize when both submitted", async () => {
    const { prisma } = makeDb({
      ageMs: TWO_MIN + 1000,
      perfs: [
        { playerId: P1, mode: "ranked_pvp", scoreTotal: 88 },
        { playerId: P2, mode: "ranked_pvp", scoreTotal: 70 },
      ],
    });
    const r = await tryResolveAbandonedMatch(prisma as never, MATCH);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("both_submitted");
  });

  it("rejects a non-participant requester", async () => {
    const { prisma } = makeDb({ ageMs: TWO_MIN + 1000, perfs: [{ playerId: P1, mode: "ranked_pvp", scoreTotal: 88 }] });
    const r = await tryResolveAbandonedMatch(prisma as never, MATCH, "99999999-9999-4999-8999-999999999999");
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("not_participant");
  });

  it("won't re-resolve an already finalized match", async () => {
    const { prisma } = makeDb({ ageMs: TWO_MIN + 1000, status: "completed", perfs: [] });
    const r = await tryResolveAbandonedMatch(prisma as never, MATCH);
    expect(r.resolved).toBe(false);
    if (!r.resolved) expect(r.reason).toBe("already_finalized");
  });
});
