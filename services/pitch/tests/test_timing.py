import numpy as np

from app.scoring import detect_onsets, score_timing
from tests.conftest import melody, sine

# C4 D4 E4 F4, half a second each, after a short lead-in (onset detection
# needs preceding silence, so the first note can't begin at t=0).
MELODY = [(0.2, 0.7, 60), (0.7, 1.2, 62), (1.2, 1.7, 64), (1.7, 2.2, 65)]
REFERENCE = [{"start": s, "end": e, "midi": m} for s, e, m in MELODY]


def test_detect_onsets_finds_each_note_start():
    y, sr = melody(MELODY)
    onsets = detect_onsets(y, sr)
    for start, _e, _m in MELODY:
        nearest = min(abs(o - start) for o in onsets)
        assert nearest < 0.12, f"no onset near {start}s (closest {nearest:.3f})"


def test_timing_high_when_notes_are_on_time():
    y, sr = melody(MELODY)
    result = score_timing(detect_onsets(y, sr), REFERENCE)
    assert result["referenceOnsets"] == 4
    assert result["scoreTiming"] is not None and result["scoreTiming"] >= 75.0


def test_timing_low_for_a_single_held_tone():
    # One continuous tone has a single onset; only the first reference note lines up.
    y, sr = sine(440.0, dur=2.0)
    result = score_timing(detect_onsets(y, sr), REFERENCE)
    assert result["scoreTiming"] is not None and result["scoreTiming"] <= 50.0


def test_timing_low_when_everything_is_shifted_late():
    # Shift by half the note spacing so onsets land between reference onsets,
    # not aliased onto the next note.
    shifted = [(s + 0.25, e + 0.25, m) for s, e, m in MELODY]
    y, sr = melody(shifted)
    result = score_timing(detect_onsets(y, sr), REFERENCE)  # scored vs unshifted ref
    assert result["scoreTiming"] is not None and result["scoreTiming"] <= 50.0


def test_no_reference_yields_no_timing_score():
    y, sr = melody(MELODY)
    result = score_timing(detect_onsets(y, sr), [])
    assert result["scoreTiming"] is None
    assert result["referenceOnsets"] == 0
