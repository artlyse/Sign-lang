from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
DATASET_DIR = ROOT / "dataset"
DATASET_DIR.mkdir(parents=True, exist_ok=True)


def normalize_label(value: str) -> str:
    value = str(value or "").strip().upper()
    value = re.sub(r"\s+", "_", value)
    value = re.sub(r"[^A-ZÁÉÍÓÚÜÑ0-9_-]", "", value)
    if not value:
        raise ValueError("La etiqueta no puede estar vacia")
    return value


def save_sample(label: str, sequence: np.ndarray, source: str) -> Path:
    label = normalize_label(label)
    folder = DATASET_DIR / label
    folder.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    path = folder / f"{stamp}_{source}.npz"
    np.savez_compressed(
        path,
        sequence=np.asarray(sequence, dtype=np.float32),
        label=label,
        source=source,
    )
    return path
