"""Pitch detection (librosa PYIN) and pitch-accuracy scoring.

Kept free of any web framework so it can be unit-tested directly.
"""
from __future__ import annotations

from typing import Optional, Sequence, TypedDict

import librosa
import numpy as np

# Sensible vocal range: C2 (~65 Hz) to C7 (~2093 Hz).
DEFAULT_FMIN = librosa.note_to_hz("C2")
DEFAULT_FMAX = librosa.note_to_hz("C7")


class ReferenceNote(TypedDict):
    start: float  # seconds
    end: float    # seconds
    midi: float   # MIDI note number (60 = middle C)


class PitchResult(TypedDict):
    scorePitch: Optional[float]   # 0–100, or None if nothing to evaluate
    evaluatedFrames: int          # frames with both a detected pitch and a reference note
    voicedFrames: int
    totalFrames: int
    voicedRatio: float
    meanCentsError: Optional[float]


def midi_to_hz(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def detect_f0(
    y: np.ndarray,
    sr: int,
    fmin: float = DEFAULT_FMIN,
    fmax: float = DEFAULT_FMAX,
):
    """Return (f0_hz, voiced_flag, times). f0 is NaN on unvoiced frames."""
    f0, voiced_flag, _ = librosa.pyin(y, sr=sr, fmin=fmin, fmax=fmax)
    times = librosa.times_like(f0, sr=sr)
    return f0, voiced_flag, times


def _reference_midi_at(reference: Sequence[ReferenceNote], t: float) -> Optional[float]:
    """The target MIDI note active at time t, or None if the song is silent then."""
    for note in reference:
        try:
            if float(note["start"]) <= t < float(note["end"]):
                return float(note["midi"])
        except (KeyError, TypeError, ValueError):
            continue
    return None


def score_pitch(
    f0_hz: np.ndarray,
    times: np.ndarray,
    reference: Sequence[ReferenceNote],
    cents_tolerance: float = 100.0,
) -> PitchResult:
    """Compare a detected f0 contour against reference notes.

    A frame counts as a hit when the singer is within `cents_tolerance` of the
    target note (100 cents = one semitone). The score is the fraction of
    evaluated frames (voiced AND with a target note) that are hits.
    """
    total = int(len(f0_hz))
    voiced = 0
    evaluated = 0
    hits = 0
    cents_errors: list[float] = []

    for hz, t in zip(f0_hz, times):
        if hz is None or np.isnan(hz) or hz <= 0:
            continue
        voiced += 1
        target_midi = _reference_midi_at(reference, float(t))
        if target_midi is None:
            continue
        evaluated += 1
        ref_hz = midi_to_hz(target_midi)
        cents = 1200.0 * np.log2(hz / ref_hz)
        cents_errors.append(abs(float(cents)))
        if abs(cents) <= cents_tolerance:
            hits += 1

    score = round(100.0 * hits / evaluated, 1) if evaluated else None
    mean_cents = round(float(np.mean(cents_errors)), 1) if cents_errors else None

    return PitchResult(
        scorePitch=score,
        evaluatedFrames=evaluated,
        voicedFrames=voiced,
        totalFrames=total,
        voicedRatio=round(voiced / total, 3) if total else 0.0,
        meanCentsError=mean_cents,
    )
