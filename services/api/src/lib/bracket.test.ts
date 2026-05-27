import { describe, it, expect } from "vitest";
import {
  nextPowerOfTwo,
  seedSlots,
  buildFirstRound,
  byeWinner,
  decideWinner,
  nextRound,
} from "./bracket.js";

describe("nextPowerOfTwo", () => {
  it("rounds up to a power of two", () => {
    expect([1, 2, 3, 5, 8, 9].map(nextPowerOfTwo)).toEqual([1, 2, 4, 8, 8, 16]);
  });
});

describe("seedSlots", () => {
  it("spreads top seeds to opposite halves", () => {
    expect(seedSlots(2)).toEqual([1, 2]);
    expect(seedSlots(4)).toEqual([1, 4, 2, 3]);
    expect(seedSlots(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    // 1 and 2 always land in opposite halves.
    const s8 = seedSlots(8);
    expect(s8.indexOf(1) < 4).toBe(true);
    expect(s8.indexOf(2) >= 4).toBe(true);
  });
});

describe("buildFirstRound", () => {
  it("pairs a full bracket (4 players: 1v4, 2v3)", () => {
    const r = buildFirstRound(["p1", "p2", "p3", "p4"]); // seed order
    expect(r).toEqual([
      { slot: 0, player1Id: "p1", player2Id: "p4" },
      { slot: 1, player1Id: "p2", player2Id: "p3" },
    ]);
  });

  it("gives byes to top seeds and never pairs two byes", () => {
    const r = buildFirstRound(["p1", "p2", "p3"]); // bracket size 4, seed 4 is a bye
    // slots: (seed1 vs seed4=bye), (seed2 vs seed3)
    expect(r[0]).toEqual({ slot: 0, player1Id: "p1", player2Id: null });
    expect(r[1]).toEqual({ slot: 1, player1Id: "p2", player2Id: "p3" });
    for (const m of r) expect(m.player1Id === null && m.player2Id === null).toBe(false);
  });

  it("handles 5 entrants (bracket of 8) without double byes", () => {
    const r = buildFirstRound(["p1", "p2", "p3", "p4", "p5"]);
    expect(r).toHaveLength(4);
    for (const m of r) expect(m.player1Id === null && m.player2Id === null).toBe(false);
  });
});

describe("byeWinner", () => {
  it("advances the present player on a bye, else null", () => {
    expect(byeWinner({ slot: 0, player1Id: "p1", player2Id: null })).toBe("p1");
    expect(byeWinner({ slot: 0, player1Id: null, player2Id: "p2" })).toBe("p2");
    expect(byeWinner({ slot: 0, player1Id: "p1", player2Id: "p2" })).toBeNull();
  });
});

describe("decideWinner", () => {
  it("higher score wins; ties go to player1", () => {
    expect(decideWinner("a", "b", 90, 80)).toBe("a");
    expect(decideWinner("a", "b", 80, 90)).toBe("b");
    expect(decideWinner("a", "b", 88, 88)).toBe("a");
  });
});

describe("nextRound", () => {
  it("pairs consecutive winners", () => {
    expect(nextRound(["a", "b", "c", "d"])).toEqual([
      { slot: 0, player1Id: "a", player2Id: "b" },
      { slot: 1, player1Id: "c", player2Id: "d" },
    ]);
  });
});
