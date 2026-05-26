import { describe, it, expect } from "vitest";
import { isUuidString } from "./ids.js";

describe("isUuidString", () => {
  it("accepts a valid v4 UUID", () => {
    expect(isUuidString("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isUuidString("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it.each([
    ["empty string", ""],
    ["plain text", "not-a-uuid"],
    ["missing groups", "550e8400-e29b-41d4-a716"],
    ["version 0 (invalid)", "550e8400-e29b-01d4-a716-446655440000"],
    ["bad variant nibble", "550e8400-e29b-41d4-c716-446655440000"],
    ["non-hex chars", "550e8400-e29b-41d4-a716-44665544zzzz"],
  ])("rejects %s", (_label, value) => {
    expect(isUuidString(value)).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isUuidString(123 as unknown as string)).toBe(false);
    expect(isUuidString(null as unknown as string)).toBe(false);
    expect(isUuidString(undefined as unknown as string)).toBe(false);
  });
});
