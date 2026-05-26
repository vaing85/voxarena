import numpy as np

from app.scoring import detect_f0, midi_to_hz, score_pitch
from tests.conftest import sine

A4_MIDI = 69      # 440 Hz
C4_MIDI = 60      # ~261.6 Hz


def test_midi_to_hz_reference_pitches():
    assert round(midi_to_hz(69), 1) == 440.0
    assert round(midi_to_hz(60), 1) == 261.6


def test_detect_f0_tracks_a_pure_tone():
    y, sr = sine(440.0)
    f0, _voiced, _times = detect_f0(y, sr)
    voiced = f0[~np.isnan(f0)]
    assert voiced.size > 0
    # Median detected pitch should be within a semitone of 440 Hz.
    assert abs(np.median(voiced) - 440.0) < 26.0


def test_score_is_high_when_singing_the_target_note():
    y, sr = sine(440.0)
    f0, _voiced, times = detect_f0(y, sr)
    result = score_pitch(f0, times, [{"start": 0.0, "end": 1.5, "midi": A4_MIDI}])
    assert result["evaluatedFrames"] > 0
    assert result["scorePitch"] is not None and result["scorePitch"] > 90.0
    assert result["meanCentsError"] is not None and result["meanCentsError"] < 50.0


def test_score_is_low_when_singing_the_wrong_note():
    y, sr = sine(440.0)  # singing A4 against a C4 target
    f0, _voiced, times = detect_f0(y, sr)
    result = score_pitch(f0, times, [{"start": 0.0, "end": 1.5, "midi": C4_MIDI}])
    assert result["scorePitch"] is not None and result["scorePitch"] < 10.0


def test_no_reference_yields_no_score():
    y, sr = sine(440.0)
    f0, _voiced, times = detect_f0(y, sr)
    result = score_pitch(f0, times, [])
    assert result["scorePitch"] is None
    assert result["evaluatedFrames"] == 0


def test_malformed_reference_notes_are_skipped():
    y, sr = sine(440.0)
    f0, _voiced, times = detect_f0(y, sr)
    result = score_pitch(f0, times, [{"start": 0.0}, {"bogus": 1}])
    assert result["scorePitch"] is None
