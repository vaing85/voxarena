"""VoxArena pitch service — FastAPI app.

POST /analyze: multipart audio (WAV) + a JSON `reference` of notes -> pitch score.
The Node API (server-authoritative scoring) is the intended caller; this service
only computes the pitch layer from audio.
"""
from __future__ import annotations

import io
import json

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .scoring import (
    detect_f0,
    detect_onsets,
    score_pitch,
    score_stability,
    score_timing,
)

app = FastAPI(title="VoxArena Pitch Service", version="0.1.0")


@app.get("/health")
def health():
    return {"ok": True, "service": "voxarena-pitch"}


@app.post("/analyze")
async def analyze(audio: UploadFile = File(...), reference: str = Form("[]")):
    try:
        notes = json.loads(reference)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="reference must be valid JSON")
    if not isinstance(notes, list):
        raise HTTPException(
            status_code=400,
            detail="reference must be a JSON array of {start, end, midi}",
        )

    raw = await audio.read()
    try:
        y, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=False)
    except Exception:
        raise HTTPException(status_code=400, detail="could not decode audio (expect WAV)")

    if y.ndim > 1:  # stereo -> mono
        y = y.mean(axis=1)
    if y.size == 0:
        raise HTTPException(status_code=400, detail="empty audio")

    mono = np.ascontiguousarray(y)
    f0, _voiced, times = detect_f0(mono, int(sr))
    pitch = score_pitch(f0, times, notes)
    timing = score_timing(detect_onsets(mono, int(sr)), notes)
    stability = score_stability(f0, times, notes)
    return {
        "sampleRate": int(sr),
        "durationSec": round(len(y) / float(sr), 3),
        **pitch,
        **timing,
        **stability,
    }
