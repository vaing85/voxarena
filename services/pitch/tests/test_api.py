import json

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import sine, wav_bytes

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_analyze_scores_a_matching_tone_high():
    y, sr = sine(440.0)
    reference = json.dumps([{"start": 0.0, "end": 1.5, "midi": 69}])
    res = client.post(
        "/analyze",
        files={"audio": ("tone.wav", wav_bytes(y, sr), "audio/wav")},
        data={"reference": reference},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["sampleRate"] == sr
    assert body["scorePitch"] > 90.0


def test_analyze_rejects_non_json_reference():
    y, sr = sine(440.0)
    res = client.post(
        "/analyze",
        files={"audio": ("tone.wav", wav_bytes(y, sr), "audio/wav")},
        data={"reference": "not-json"},
    )
    assert res.status_code == 400


def test_analyze_rejects_undecodable_audio():
    res = client.post(
        "/analyze",
        files={"audio": ("bad.wav", b"not really audio", "audio/wav")},
        data={"reference": "[]"},
    )
    assert res.status_code == 400
