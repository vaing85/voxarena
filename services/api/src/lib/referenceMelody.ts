/**
 * Song-content pipeline: turn a compact melody notation into the
 * `Song.referenceNotes` shape ({ start, end, midi } in seconds) used by the
 * pitch service. Pure + unit-tested. A future MIDI importer can target the same
 * note-list output, so the scoring contract stays identical.
 *
 * Notation: space-separated `NOTE:DUR` tokens.
 *   NOTE — letter A–G, optional accidental (# or b), octave (e.g. C4, F#3, Bb4)
 *          or `R` for a rest.
 *   DUR  — w|h|q|e|s (whole/half/quarter/eighth/sixteenth), optional trailing
 *          `.` for dotted (×1.5).
 */

export type ReferenceNote = { start: number; end: number; midi: number };

const PITCH_CLASS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

const DURATION_BEATS: Record<string, number> = {
  w: 4, h: 2, q: 1, e: 0.5, s: 0.25,
};

/** Convert a note name like "C4", "F#3", "Bb4" to a MIDI number (C4 = 60). */
export function noteNameToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name);
  if (!m) throw new Error(`Invalid note name: "${name}"`);
  let pc = PITCH_CLASS[m[1].toUpperCase()];
  if (m[2] === "#") pc += 1;
  else if (m[2] === "b") pc -= 1;
  const octave = parseInt(m[3], 10);
  return (octave + 1) * 12 + pc;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Parse a melody notation string into reference notes at the given tempo. */
export function parseMelody(notation: string, bpm = 100): ReferenceNote[] {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new Error("bpm must be positive");
  const secondsPerBeat = 60 / bpm;

  let t = 0;
  const notes: ReferenceNote[] = [];
  for (const token of notation.trim().split(/\s+/).filter(Boolean)) {
    const [pitch, durRaw] = token.split(":");
    if (!durRaw) throw new Error(`Bad token "${token}" (expected NOTE:DUR)`);

    let dur = durRaw;
    let dotted = false;
    if (dur.endsWith(".")) {
      dotted = true;
      dur = dur.slice(0, -1);
    }
    const beats = DURATION_BEATS[dur];
    if (beats == null) throw new Error(`Bad duration "${durRaw}" in "${token}"`);

    const seconds = beats * secondsPerBeat * (dotted ? 1.5 : 1);
    if (pitch.toUpperCase() !== "R") {
      notes.push({ start: round3(t), end: round3(t + seconds), midi: noteNameToMidi(pitch) });
    }
    t += seconds;
  }
  return notes;
}
