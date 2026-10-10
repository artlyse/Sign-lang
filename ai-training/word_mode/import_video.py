"""Importa videos como muestras del modo Palabra.

Extrae features frame a frame, normaliza la duración a la secuencia esperada y
guarda el resultado en el mismo formato NPZ de la captura por cámara."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2

from dataset_utils import save_sample
from download_models import ensure_models
from feature_extractor import WordFeatureExtractor, resample_sequence


def import_video(label: str, video_path: str):
    source = Path(video_path)
    if not source.exists():
        raise FileNotFoundError(source)

    hand_model, pose_model = ensure_models()
    extractor = WordFeatureExtractor(hand_model, pose_model)
    cap = cv2.VideoCapture(str(source))

    if not cap.isOpened():
        extractor.close()
        raise RuntimeError(f"No se pudo abrir {source}")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    features = []
    frame_index = 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            timestamp_ms = int((frame_index / max(fps, 1.0)) * 1000.0)
            bundle = extractor.process(frame, timestamp_ms)
            if bundle is not None:
                features.append(bundle.features)
            frame_index += 1
    finally:
        cap.release()
        extractor.close()

    if len(features) < 8:
        raise RuntimeError(
            "Muy pocos frames con manos detectadas. Usa un video donde la seña sea visible."
        )

    sequence = resample_sequence(features)
    path = save_sample(label, sequence, f"video_{source.stem}")
    print(f"Video importado: {source.name}")
    print(f"Frames utiles: {len(features)}")
    print(f"Muestra guardada: {path}")
    return path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--video", required=True)
    args = parser.parse_args()
    import_video(args.label, args.video)
