import { describe, it, expect } from "vitest";
import { encodeWav } from "./audio";

function readStr(view: DataView, off: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(off + i));
  return s;
}

describe("encodeWav", () => {
  it("writes a valid 16-bit mono WAV header", async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const blob = encodeWav(samples, 8000);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + samples.length * 2);

    const view = new DataView(await blob.arrayBuffer());
    expect(readStr(view, 0, 4)).toBe("RIFF");
    expect(readStr(view, 8, 4)).toBe("WAVE");
    expect(readStr(view, 12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(8000); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(readStr(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
  });

  it("clamps and quantizes samples to 16-bit", async () => {
    const view = new DataView(await encodeWav(new Float32Array([1, -1, 2]), 8000).arrayBuffer());
    expect(view.getInt16(44, true)).toBe(0x7fff); // +1.0
    expect(view.getInt16(46, true)).toBe(-0x8000); // -1.0
    expect(view.getInt16(48, true)).toBe(0x7fff); // clamped from +2
  });
});
