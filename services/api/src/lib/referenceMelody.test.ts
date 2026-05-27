import { describe, it, expect } from "vitest";
import { noteNameToMidi, parseMelody } from "./referenceMelody.js";

describe("noteNameToMidi", () => {
  it("maps note names to MIDI numbers", () => {
    expect(noteNameToMidi("C4")).toBe(60);
    expect(noteNameToMidi("A4")).toBe(69);
    expect(noteNameToMidi("C#4")).toBe(61);
    expect(noteNameToMidi("Db4")).toBe(61);
    expect(noteNameToMidi("Bb3")).toBe(58);
  });

  it("throws on a bad name", () => {
    expect(() => noteNameToMidi("H4")).toThrow();
    expect(() => noteNameToMidi("C")).toThrow();
  });
});

describe("parseMelody", () => {
  it("lays notes out sequentially at the given tempo", () => {
    // 120 bpm -> 0.5s per beat (quarter).
    expect(parseMelody("C4:q D4:q", 120)).toEqual([
      { start: 0, end: 0.5, midi: 60 },
      { start: 0.5, end: 1, midi: 62 },
    ]);
  });

  it("advances over rests without emitting a note (lead-in)", () => {
    const notes = parseMelody("R:q C4:q", 120);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toEqual({ start: 0.5, end: 1, midi: 60 });
  });

  it("handles half notes and dotted durations", () => {
    // 100 bpm -> 0.6s per beat. half = 1.2s; dotted quarter = 0.9s.
    expect(parseMelody("C4:h", 100)).toEqual([{ start: 0, end: 1.2, midi: 60 }]);
    expect(parseMelody("C4:q.", 100)).toEqual([{ start: 0, end: 0.9, midi: 60 }]);
  });

  it("rejects malformed tokens and durations", () => {
    expect(() => parseMelody("C4", 100)).toThrow();
    expect(() => parseMelody("C4:z", 100)).toThrow();
  });
});
