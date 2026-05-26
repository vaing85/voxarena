import io

import numpy as np
import soundfile as sf


def sine(freq_hz: float, dur: float = 1.5, sr: int = 22050, amp: float = 0.5):
    """A mono sine tone at a fixed frequency."""
    t = np.linspace(0.0, dur, int(sr * dur), endpoint=False)
    return (amp * np.sin(2.0 * np.pi * freq_hz * t)).astype(np.float32), sr


def melody(notes, sr: int = 22050, gap: float = 0.06, amp: float = 0.5):
    """Synthesize a sequence of notes with a short silence before each note's
    end, so each note start is a clear onset. `notes` are (start, end, midi)."""
    total = max(end for _, end, _ in notes)
    y = np.zeros(int(sr * total), dtype=np.float32)
    for start, end, midi in notes:
        freq = 440.0 * (2.0 ** ((midi - 69) / 12.0))
        s = int(sr * start)
        e = int(sr * max(start, end - gap))
        t = np.arange(e - s) / sr
        y[s:e] = (amp * np.sin(2.0 * np.pi * freq * t)).astype(np.float32)
    return y, sr


def vibrato(freq_hz: float, dur: float = 1.5, sr: int = 22050,
            rate_hz: float = 5.0, depth_cents: float = 80.0, amp: float = 0.5):
    """A tone whose pitch oscillates ±depth_cents (unsteady singing)."""
    n = int(sr * dur)
    t = np.arange(n) / sr
    inst = freq_hz * 2.0 ** ((depth_cents / 1200.0) * np.sin(2.0 * np.pi * rate_hz * t))
    phase = 2.0 * np.pi * np.cumsum(inst) / sr
    return (amp * np.sin(phase)).astype(np.float32), sr


def glide_melody(notes, sr: int = 22050, ramp_sec: float = 0.3, gap: float = 0.06, amp: float = 0.5):
    """Like `melody`, but each note slides up from the previous pitch over
    `ramp_sec` instead of jumping cleanly — i.e. sloppy note transitions."""
    total = max(end for _, end, _ in notes)
    y = np.zeros(int(sr * total), dtype=np.float32)
    prev_midi = notes[0][2]
    for start, end, midi in notes:
        f_prev = 440.0 * (2.0 ** ((prev_midi - 69) / 12.0))
        f_tgt = 440.0 * (2.0 ** ((midi - 69) / 12.0))
        a = int(sr * start)
        b = int(sr * max(start, end - gap))
        t = np.arange(b - a) / sr
        ramp = np.clip(t / ramp_sec, 0.0, 1.0)
        inst = f_prev + (f_tgt - f_prev) * ramp
        phase = 2.0 * np.pi * np.cumsum(inst) / sr
        y[a:b] = (amp * np.sin(phase)).astype(np.float32)
        prev_midi = midi
    return y, sr


def wav_bytes(y: np.ndarray, sr: int) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV")
    return buf.getvalue()
