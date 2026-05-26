import io

import numpy as np
import soundfile as sf


def sine(freq_hz: float, dur: float = 1.5, sr: int = 22050, amp: float = 0.5):
    """A mono sine tone at a fixed frequency."""
    t = np.linspace(0.0, dur, int(sr * dur), endpoint=False)
    return (amp * np.sin(2.0 * np.pi * freq_hz * t)).astype(np.float32), sr


def wav_bytes(y: np.ndarray, sr: int) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV")
    return buf.getvalue()
