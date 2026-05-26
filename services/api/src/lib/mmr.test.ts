import { describe, it, expect } from "vitest";
import { tierFromMmr, expectedScore, applyElo1v1 } from "./mmr.js";

describe("tierFromMmr", () => {
  it.each([
    [0, "Bronze"],
    [1099, "Bronze"],
    [1100, "Silver"],
    [1249, "Silver"],
    [1250, "Gold"],
    [1399, "Gold"],
    [1400, "Platinum"],
    [1550, "Diamond"],
    [1700, "Master"],
    [5000, "Master"],
  ])("maps mmr %i to %s", (mmr, tier) => {
    expect(tierFromMmr(mmr)).toBe(tier);
  });

  it("floors negative mmr to the lowest tier", () => {
    expect(tierFromMmr(-200)).toBe("Bronze");
  });
});

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 10);
  });

  it("is symmetric (a vs b + b vs a = 1)", () => {
    expect(expectedScore(1600, 1400) + expectedScore(1400, 1600)).toBeCloseTo(
      1,
      10
    );
  });

  it("favors the higher-rated player", () => {
    expect(expectedScore(1700, 1300)).toBeGreaterThan(0.5);
    expect(expectedScore(1300, 1700)).toBeLessThan(0.5);
  });
});

describe("applyElo1v1", () => {
  it("moves equal ratings by half of k", () => {
    const { winnerNew, loserNew } = applyElo1v1(1500, 1500);
    expect(winnerNew).toBe(1516);
    expect(loserNew).toBe(1484);
  });

  it("conserves total rating (within rounding)", () => {
    const { winnerNew, loserNew } = applyElo1v1(1480, 1620);
    expect(winnerNew + loserNew).toBe(1480 + 1620);
  });

  it("winner gains and loser loses", () => {
    const { winnerNew, loserNew } = applyElo1v1(1500, 1500);
    expect(winnerNew).toBeGreaterThan(1500);
    expect(loserNew).toBeLessThan(1500);
  });

  it("rewards an upset more than an expected win", () => {
    const upset = applyElo1v1(1300, 1700); // low-rated player wins
    const expected = applyElo1v1(1700, 1300); // high-rated player wins
    const upsetGain = upset.winnerNew - 1300;
    const expectedGain = expected.winnerNew - 1700;
    expect(upsetGain).toBeGreaterThan(expectedGain);
  });

  it("respects a custom k factor", () => {
    const small = applyElo1v1(1500, 1500, 16);
    expect(small.winnerNew).toBe(1508);
    expect(small.loserNew).toBe(1492);
  });
});
