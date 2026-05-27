/**
 * Author tool: print a song's referenceNotes JSON from melody notation.
 *   npm run melody -- "R:q C4:q D4:q E4:h" 100
 * Pipe the output into a Song.referenceNotes value.
 */
import { parseMelody } from "../src/lib/referenceMelody.js";

const [, , notation, bpmRaw] = process.argv;
if (!notation) {
  console.error('usage: npm run melody -- "<NOTE:DUR ...>" [bpm]');
  console.error('example: npm run melody -- "R:q C4:q C4:q G4:q G4:q A4:q A4:q G4:h" 100');
  process.exit(1);
}
const bpm = bpmRaw ? Number(bpmRaw) : 100;
console.log(JSON.stringify(parseMelody(notation, bpm)));
