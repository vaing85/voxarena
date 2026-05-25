import { describe, it, expect } from "vitest";
import { tierFromMmr, expectedScore, applyElo1v1, applyEloDraw } from "./mmr.js";

describe("tierFromMmr", () => {
  it("maps MMR to the right tier at boundaries", () => {
    expect(tierFromMmr(0)).toBe("Bronze");
    expect(tierFromMmr(1099)).toBe("Bronze");
    expect(tierFromMmr(1100)).toBe("Silver");
    expect(tierFromMmr(1250)).toBe("Gold");
    expect(tierFromMmr(1400)).toBe("Platinum");
    expect(tierFromMmr(1550)).toBe("Diamond");
    expect(tierFromMmr(1700)).toBe("Master");
    expect(tierFromMmr(9999)).toBe("Master");
  });

  it("never drops below Bronze", () => {
    expect(tierFromMmr(-500)).toBe("Bronze");
  });
});

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
  });

  it("favors the higher-rated player", () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    expect(expectedScore(1000, 1200)).toBeLessThan(0.5);
  });

  it("is complementary between the two players", () => {
    expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(1, 10);
  });
});

describe("applyElo1v1", () => {
  it("moves equal ratings by k/2", () => {
    const { winnerNew, loserNew } = applyElo1v1(1000, 1000);
    expect(winnerNew).toBe(1016);
    expect(loserNew).toBe(984);
  });

  it("awards fewer points when a favorite beats an underdog", () => {
    const favorite = applyElo1v1(1400, 1000);
    const upset = applyElo1v1(1000, 1400);
    expect(favorite.winnerNew - 1400).toBeLessThan(upset.winnerNew - 1000);
  });

  it("winner always gains and loser always loses", () => {
    const { winnerNew, loserNew } = applyElo1v1(1000, 1300);
    expect(winnerNew).toBeGreaterThan(1000);
    expect(loserNew).toBeLessThan(1300);
  });
});

describe("applyEloDraw", () => {
  it("leaves equal ratings unchanged", () => {
    const { new1, new2 } = applyEloDraw(1000, 1000);
    expect(new1).toBe(1000);
    expect(new2).toBe(1000);
  });

  it("transfers points from the favorite to the underdog", () => {
    const { new1, new2 } = applyEloDraw(1300, 1000);
    expect(new1).toBeLessThan(1300);
    expect(new2).toBeGreaterThan(1000);
  });
});
