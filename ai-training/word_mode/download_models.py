from __future__ import annotations

from pathlib import Path
from urllib.request import urlretrieve

ROOT = Path(__file__).resolve().parent
MODELS = ROOT / "models"
MODELS.mkdir(parents=True, exist_ok=True)

FILES = {
    "hand_landmarker.task": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    "pose_landmarker_lite.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
}


def ensure_models():
    for name, url in FILES.items():
        target = MODELS / name
        if target.exists() and target.stat().st_size > 100_000:
            print(f"OK: {name}")
            continue
        print(f"Descargando {name}...")
        urlretrieve(url, target)
        print(f"Guardado: {target}")
    return MODELS / "hand_landmarker.task", MODELS / "pose_landmarker_lite.task"


if __name__ == "__main__":
    ensure_models()
