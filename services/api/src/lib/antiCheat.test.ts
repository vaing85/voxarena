import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  analyzePerformance,
  VelocityTracker,
  VELOCITY_THRESHOLD,
  type PerformanceLike,
} from "./antiCheat.js";
import { processEvent } from "./eventConsumer.js";

const consistent: PerformanceLike = {
  scorePitch: 80,
  scoreTiming: 80,
  scoreStability: 80,
  scoreDynamics: 80,
  scoreTransitions: 80,
  scoreTotal: 80, // matches the weighted formula
};

describe("analyzePerformance", () => {
  it("does not flag a consistent score", () => {
    expect(analyzePerformance(consistent, 1)).toEqual([]);
  });

  it("flags a fabricated total that can't match its layers", () => {
    const flags = analyzePerformance({ ...consistent, scoreTotal: 100 }, 1);
    const mismatch = flags.find((f) => f.reason === "score_mismatch");
    expect(mismatch).toBeTruthy();
    expect(mismatch?.severity).toBe("high");
    expect(mismatch?.details).toMatchObject({ expected: 80, stored: 100 });
  });

  it("flags an all-perfect run (low severity)", () => {
    const perfect: PerformanceLike = {
      scorePitch: 100, scoreTiming: 100, scoreStability: 100,
      scoreDynamics: 100, scoreTransitions: 100, scoreTotal: 100,
    };
    const flags = analyzePerformance(perfect, 1);
    expect(flags.map((f) => f.reason)).toContain("suspicious_perfect");
    expect(flags.map((f) => f.reason)).not.toContain("score_mismatch");
  });

  it("flags high submission velocity", () => {
    const flags = analyzePerformance(consistent, VELOCITY_THRESHOLD + 1);
    expect(flags.map((f) => f.reason)).toContain("high_velocity");
  });
});

describe("VelocityTracker", () => {
  it("counts only submissions within the window", () => {
    const t = new VelocityTracker(1000);
    expect(t.record("p", 0)).toBe(1);
    expect(t.record("p", 500)).toBe(2);
    expect(t.record("p", 1400)).toBe(2); // window=1000: t=0 aged out, t=500 kept
  });
});

describe("processEvent", () => {
  it("ignores non-performance events", async () => {
    const prisma = { cheatFlag: { createMany: vi.fn() } } as unknown as PrismaClient;
    const n = await processEvent(prisma, JSON.stringify({ event: "match.completed" }), new VelocityTracker());
    expect(n).toBe(0);
    expect((prisma as any).cheatFlag.createMany).not.toHaveBeenCalled();
  });

  it("persists flags for a suspicious performance event", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { cheatFlag: { createMany } } as unknown as PrismaClient;
    const evt = JSON.stringify({
      event: "performance.recorded",
      playerId: "p1",
      performanceId: "perf-1",
      scorePitch: 80, scoreTiming: 80, scoreStability: 80,
      scoreDynamics: 80, scoreTransitions: 80, scoreTotal: 100, // mismatch
    });
    const n = await processEvent(prisma, evt, new VelocityTracker());
    expect(n).toBe(1);
    expect(createMany).toHaveBeenCalledOnce();
    const arg = createMany.mock.calls[0][0].data[0];
    expect(arg).toMatchObject({ playerId: "p1", performanceId: "perf-1", reason: "score_mismatch" });
  });
});
