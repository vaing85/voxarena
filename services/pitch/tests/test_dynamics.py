import numpy as np

from app.scoring import score_dynamics

SR = 22050
REFERENCE = [{"start": 0.0, "end": 1.0, "midi": 69}]


def _tone(env_fn, dur=1.0, freq=440.0):
    t = np.arange(int(SR * dur)) / SR
    return (env_fn(t) * np.sin(2.0 * np.pi * freq * t)).astype(np.float32)


def test_dynamics_high_for_steady_volume():
    y = _tone(lambda t: 0.5 * np.ones_like(t))
    result = score_dynamics(y, SR, REFERENCE)
    assert result["evaluatedNotes"] == 1
    assert result["scoreDynamics"] is not None and result["scoreDynamics"] >= 90.0


def test_dynamics_low_for_fade_out():
    y = _tone(lambda t: 0.5 * (1.0 - t))  # ramps to silence
    result = score_dynamics(y, SR, REFERENCE)
    assert result["scoreDynamics"] is not None and result["scoreDynamics"] < 30.0


def test_steady_beats_tremolo():
    steady = score_dynamics(_tone(lambda t: 0.5 * np.ones_like(t)), SR, REFERENCE)["scoreDynamics"]
    tremolo = score_dynamics(
        _tone(lambda t: 0.5 * (0.6 + 0.4 * np.sin(2.0 * np.pi * 6.0 * t))), SR, REFERENCE
    )["scoreDynamics"]
    assert steady > tremolo


def test_dynamics_none_without_reference():
    y = _tone(lambda t: 0.5 * np.ones_like(t))
    result = score_dynamics(y, SR, [])
    assert result["scoreDynamics"] is None
    assert result["evaluatedNotes"] == 0
