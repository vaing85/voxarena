from app.scoring import detect_f0, score_transitions
from tests.conftest import glide_melody, melody

# Bigger jumps (C4 G4 C5 G4) make the transitions unambiguous; lead-in included.
MELODY = [(0.3, 0.8, 60), (0.8, 1.3, 67), (1.3, 1.8, 72), (1.8, 2.3, 67)]
REFERENCE = [{"start": s, "end": e, "midi": m} for s, e, m in MELODY]


def _transitions(y, sr):
    f0, _voiced, times = detect_f0(y, sr)
    return score_transitions(f0, times, REFERENCE)


def test_transitions_high_for_clean_note_changes():
    result = _transitions(*melody(MELODY))
    assert result["evaluatedTransitions"] == 3
    assert result["scoreTransitions"] is not None and result["scoreTransitions"] >= 80.0


def test_transitions_low_for_slow_glides():
    result = _transitions(*glide_melody(MELODY))
    assert result["scoreTransitions"] is not None and result["scoreTransitions"] <= 40.0


def test_clean_beats_glide():
    clean = _transitions(*melody(MELODY))["scoreTransitions"]
    glide = _transitions(*glide_melody(MELODY))["scoreTransitions"]
    assert clean > glide


def test_no_transitions_when_pitch_never_changes():
    same = [(0.3, 0.8, 69), (0.8, 1.3, 69)]
    ref = [{"start": s, "end": e, "midi": m} for s, e, m in same]
    f0, _voiced, times = detect_f0(*melody(same))
    result = score_transitions(f0, times, ref)
    assert result["scoreTransitions"] is None
    assert result["evaluatedTransitions"] == 0


def test_transitions_none_without_reference():
    f0, _voiced, times = detect_f0(*melody(MELODY))
    result = score_transitions(f0, times, [])
    assert result["scoreTransitions"] is None
