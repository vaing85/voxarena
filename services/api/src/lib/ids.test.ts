import { describe, it, expect } from "vitest";
import { isUuidString } from "./ids.js";

describe("isUuidString", () => {
  it("accepts a valid v4 UUID, case-insensitively", () => {
    expect(isUuidString("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuidString("11111111-1111-4111-8111-111111111111".toUpperCase())).toBe(true);
  });

  it("rejects malformed values", () => {
    expect(isUuidString("")).toBe(false);
    expect(isUuidString("not-a-uuid")).toBe(false);
    expect(isUuidString("11111111-1111-4111-8111-11111111111")).toBe(false); // too short
    expect(isUuidString("11111111111141118111111111111111")).toBe(false); // no dashes
  });

  it("rejects a non-string", () => {
    expect(isUuidString(undefined as unknown as string)).toBe(false);
  });
});
