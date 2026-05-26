from app.scoring import detect_f0, score_stability
from tests.conftest import sine, vibrato

# One sustained note covering the whole clip.
REFERENCE = [{"start": 0.0, "end": 1.5, "midi": 69}]


def _stability(y, sr):
    f0, _voiced, times = detect_f0(y, sr)
    return score_stability(f0, times, REFERENCE)


def test_stability_high_for_a_steady_tone():
    y, sr = sine(440.0, dur=1.5)
    result = _stability(y, sr)
    assert result["evaluatedNotes"] == 1
    assert result["scoreStability"] is not None and result["scoreStability"] >= 90.0
    assert result["meanStdCents"] is not None and result["meanStdCents"] < 10.0


def test_stability_lower_for_vibrato():
    y, sr = vibrato(440.0, dur=1.5, depth_cents=80.0)
    result = _stability(y, sr)
    assert result["scoreStability"] is not None and result["scoreStability"] < 75.0
    assert result["meanStdCents"] is not None and result["meanStdCents"] > 20.0


def test_steady_beats_vibrato():
    steady = _stability(*sine(440.0, dur=1.5))["scoreStability"]
    wobbly = _stability(*vibrato(440.0, dur=1.5, depth_cents=80.0))["scoreStability"]
    assert steady > wobbly


def test_stability_none_without_reference():
    f0, _voiced, times = detect_f0(*sine(440.0, dur=1.5))
    result = score_stability(f0, times, [])
    assert result["scoreStability"] is None
    assert result["evaluatedNotes"] == 0
