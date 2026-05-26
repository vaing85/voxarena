# VoxArena — Pitch service

Real pitch detection (librosa **PYIN**, CPU-only) and pitch-accuracy scoring.
This is the **Layer A** scoring engine from [ARCHITECTURE](../../docs/ARCHITECTURE.md);
the Node API stays the score authority and is the intended caller.

## Run

```bash
cd services/pitch
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt        # runtime + test deps
uvicorn app.main:app --reload --port 8000  # dev server
pytest -q                                  # tests (synthetic audio)
```

> `soundfile` needs the system `libsndfile` library (preinstalled on most Linux/macOS; the Dockerfile installs `libsndfile1`).

## API

### `GET /health`
`{ "ok": true, "service": "voxarena-pitch" }`

### `POST /analyze` (multipart)
| field | type | notes |
|-------|------|-------|
| `audio` | file | WAV (mono or stereo; stereo is averaged to mono) |
| `reference` | string | JSON array of notes: `[{ "start": 0.0, "end": 1.5, "midi": 69 }]` (seconds + MIDI note) |

Response:
```json
{
  "sampleRate": 22050,
  "durationSec": 1.5,
  "scorePitch": 98.3,        // 0–100, or null if nothing to evaluate
  "evaluatedFrames": 120,    // voiced frames that had a target note
  "voicedFrames": 124,
  "totalFrames": 130,
  "voicedRatio": 0.954,
  "meanCentsError": 7.8,     // mean absolute cents off target, or null
  "scoreTiming": 100.0,      // 0–100, or null if no reference onsets
  "matchedOnsets": 4,
  "referenceOnsets": 4,
  "meanOnsetErrorMs": 35.1,  // mean onset error vs reference, or null
  "scoreStability": 72.3,    // 0–100, or null if no note had enough frames
  "evaluatedNotes": 4,
  "meanStdCents": 27.7,      // mean within-note pitch spread, or null
  "scoreDynamics": 88.7,     // 0–100, or null if no note had enough frames
  "meanCv": 0.113,           // mean within-note RMS coefficient of variation, or null
  "scoreTransitions": 100.0, // 0–100, or null if the melody has no pitch changes
  "evaluatedTransitions": 3,
  "meanSettleRatio": 1.0     // mean fraction of post-onset frames on the new target
}
```

**Pitch (Layer A):** a frame is a *hit* when the sung pitch is within
`cents_tolerance` (default 100 cents = one semitone) of the target note;
`scorePitch` is the hit fraction.

**Timing (Layer B):** each reference note start is matched to the nearest
detected onset (`librosa.onset.onset_detect`); it's a *hit* within
`tolerance_sec` (default 0.15s). `scoreTiming` is the fraction of reference
onsets hit. Note that onset detection needs preceding silence, so reference
melodies should begin after a short lead-in (not at t=0).

**Stability (Layer C):** the cents spread (std) of the detected pitch *within*
each note, measured around the note's own median — so it rewards a steady tone
independent of accuracy (that's Layer A). `scoreStability` falls from 100 as the
spread grows toward `max_std_cents` (default 100). Vibrato/wobble lowers it.

**Dynamics (Layer D):** volume control. With no reference loudness curve (and
arbitrary mic gain), this measures the RMS coefficient of variation (std/mean)
*within* each note, with edges trimmed so natural attack/release isn't penalised.
A well-sustained note is even; fade-outs and choppy/tremolo notes vary more.
`scoreDynamics` falls from 100 as the CV grows toward `max_cv` (default 0.5).

**Transitions (Layer E):** for each consecutive pair where the pitch changes,
look at a short window (default 0.15s) at the start of the new note and measure
the fraction of frames already within `tolerance_cents` of the new target. A
snappy, clean change settles fast; a slow portamento or messy slide lingers
off-target. `scoreTransitions` is the mean settle fraction.

## How it fits

```
client mic ──audio──▶ Node API (/performances) ──audio+reference──▶ pitch service ──scorePitch──▶ Node stores score
```

**Not wired yet (follow-ups):**
- Audio capture in the client and upload to the Node API.
- Per-song **reference pitch** (notes/MIDI) storage — `Song.referenceId` exists but holds no note data yet.
- Node calling this service (behind `PITCH_SERVICE_URL`) to replace the stub pitch layer.

Only Layer A (pitch) is implemented here; timing/stability/dynamics/transitions remain heuristic in the Node scorer.
