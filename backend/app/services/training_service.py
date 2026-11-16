"""Datos de entrenamiento aportados desde Práctica y modelo personal adaptativo.

Flujo:
1. Durante un reto de Práctica el front captura los landmarks de la mano.
2. Al evaluar el intento, las muestras se guardan en `training_samples`.
   Quedan *verificadas* si el reto fue exitoso o si el usuario confirma que
   hizo la seña correcta.
3. Las muestras estáticas verificadas forman un modelo personal k-NN que se
   combina con el MLP base en tiempo real (WebSocket). Así el sistema aprende
   la forma concreta en que cada usuario hace cada letra, sin reentrenar.
4. `export_samples` escribe las muestras en `ai-training/dataset/` con el
   mismo formato que `capture_dataset.py` / `capture_dynamic.py`, para
   reentrenar los modelos ONNX con `training/train_mlp.py` / `train_lstm.py`.
"""

from __future__ import annotations

import json
import threading
from collections import Counter
from typing import Iterable, Optional

import numpy as np
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import (
    LETRAS_STATIC,
    HYBRID_BLOCK_STATIC_DYNAMIC_LETTERS,
    PERSONAL_KNN_K,
    PERSONAL_MAX_DISTANCE,
    PERSONAL_MAX_WEIGHT,
    PERSONAL_MIN_SAMPLES_PER_LABEL,
    SENAS_DYNAMIC,
    TRAINING_DATASET_DIR,
)
from app.database import SessionLocal
from app.models.training import TrainingSample
from app.models.user_profile import UserProfile

STATIC_LABELS = [
    letter for letter in LETRAS_STATIC if letter not in HYBRID_BLOCK_STATIC_DYNAMIC_LETTERS
]
DYNAMIC_LABELS = list(SENAS_DYNAMIC)
MAX_SAMPLES_PER_LABEL = 200  # por usuario, para que el k-NN siga siendo rápido


def normalize_landmarks(landmarks: Iterable[float]) -> np.ndarray:
    """Mismo preprocesamiento que RecognitionService.normalize_landmarks."""
    pts = np.asarray(list(landmarks), dtype=np.float32).reshape(21, 3)
    pts = pts - pts[0]
    max_dist = float(np.max(np.linalg.norm(pts, axis=1)))
    if max_dist > 0:
        pts = pts / max_dist
    return pts.flatten()


def _clean_label(label: str) -> str:
    return str(label or "").strip().upper()


def label_kind(label: str) -> Optional[str]:
    label = _clean_label(label)
    if label in DYNAMIC_LABELS:
        return "dynamic"
    if label in STATIC_LABELS:
        return "static"
    return None


class PersonalModelService:
    """k-NN por usuario sobre muestras estáticas verificadas."""

    def __init__(self):
        self._cache: dict[int, dict] = {}
        self._lock = threading.Lock()

    def invalidate(self, user_id: int) -> None:
        with self._lock:
            self._cache.pop(user_id, None)

    def _load(self, user_id: int) -> dict:
        with self._lock:
            cached = self._cache.get(user_id)
            if cached is not None:
                return cached

        db = SessionLocal()
        try:
            profile = db.get(UserProfile, user_id)
            enabled = profile is None or bool(profile.learning_enabled)

            rows = db.execute(
                select(TrainingSample.label, TrainingSample.data_json)
                .where(
                    TrainingSample.user_id == user_id,
                    TrainingSample.kind == "static",
                    TrainingSample.verified.is_(True),
                )
                .order_by(TrainingSample.id.desc())
            ).all()
        finally:
            db.close()

        per_label: dict[str, list[np.ndarray]] = {}
        for label, data_json in rows:
            bucket = per_label.setdefault(label, [])
            if len(bucket) >= MAX_SAMPLES_PER_LABEL:
                continue
            try:
                bucket.append(normalize_landmarks(json.loads(data_json)))
            except Exception:
                continue

        active = {
            label: vectors
            for label, vectors in per_label.items()
            if len(vectors) >= PERSONAL_MIN_SAMPLES_PER_LABEL
        }

        X = None
        y: list[str] = []
        if active:
            X = np.stack([v for vectors in active.values() for v in vectors])
            y = [label for label, vectors in active.items() for _ in vectors]

        data = {
            "enabled": enabled,
            "X": X,
            "y": np.asarray(y),
            "counts": {label: len(v) for label, v in per_label.items()},
            "active_labels": sorted(active.keys()),
        }
        with self._lock:
            self._cache[user_id] = data
        return data

    def status(self, user_id: int) -> dict:
        data = self._load(user_id)
        total = int(len(data["y"]))
        return {
            "enabled": data["enabled"],
            "active": bool(data["enabled"] and total > 0),
            "active_labels": data["active_labels"],
            "samples_in_model": total,
            "min_samples_per_label": PERSONAL_MIN_SAMPLES_PER_LABEL,
            "max_weight": PERSONAL_MAX_WEIGHT,
        }

    def adjust(self, user_id: Optional[int], landmarks: list, result: dict) -> dict:
        """Combina la salida del MLP con el k-NN personal del usuario."""
        if user_id is None or "error" in result:
            return result

        data = self._load(user_id)
        X = data["X"]
        if not data["enabled"] or X is None or len(X) == 0:
            return result

        try:
            vector = normalize_landmarks(landmarks)
        except Exception:
            return result

        distances = np.linalg.norm(X - vector, axis=1)
        k = min(PERSONAL_KNN_K, len(distances))
        nearest = np.argpartition(distances, k - 1)[:k]
        nearest = nearest[distances[nearest] < PERSONAL_MAX_DISTANCE]
        if len(nearest) == 0:
            return result

        weights = 1.0 / (distances[nearest] + 1e-3)
        knn_scores: dict[str, float] = {}
        for idx, weight in zip(nearest, weights):
            label = str(data["y"][idx])
            knn_scores[label] = knn_scores.get(label, 0.0) + float(weight)
        total_weight = sum(knn_scores.values()) or 1.0
        knn_probs = {label: value / total_weight for label, value in knn_scores.items()}

        base_probs = {
            item["letter"]: float(item["confidence"]) for item in result.get("top3", [])
        }
        base_probs.setdefault(result.get("letter", "-"), float(result.get("confidence", 0.0)))

        # Más muestras y vecinos más cercanos => más peso al modelo personal.
        coverage = min(1.0, len(X) / float(PERSONAL_MIN_SAMPLES_PER_LABEL * 4))
        proximity = max(0.0, 1.0 - float(distances[nearest].min()) / PERSONAL_MAX_DISTANCE)
        alpha = PERSONAL_MAX_WEIGHT * coverage * proximity
        if alpha <= 0.02:
            return result

        labels = set(base_probs) | set(knn_probs)
        blended = {
            label: (1 - alpha) * base_probs.get(label, 0.0) + alpha * knn_probs.get(label, 0.0)
            for label in labels
        }
        ranking = sorted(blended.items(), key=lambda item: item[1], reverse=True)
        best_letter, best_score = ranking[0]

        adjusted = dict(result)
        adjusted["letter"] = best_letter
        adjusted["confidence"] = float(min(1.0, best_score))
        adjusted["top3"] = [
            {"letter": label, "confidence": float(score)} for label, score in ranking[:3]
        ]
        adjusted["personalized"] = {
            "weight": round(alpha, 3),
            "neighbors": int(len(nearest)),
            "base_letter": result.get("letter"),
            "changed": best_letter != result.get("letter"),
        }
        return adjusted


personal_model_service = PersonalModelService()


# ---------------------------------------------------------------------------
# Persistencia
# ---------------------------------------------------------------------------

def save_samples(
    db: Session,
    user_id: int,
    samples: list,
    *,
    verified: bool,
    attempt_id: Optional[int] = None,
    source: str = "practice",
) -> dict:
    profile = db.get(UserProfile, user_id)
    if profile is not None and not profile.learning_enabled:
        return {"saved": 0, "skipped": len(samples), "reason": "aprendizaje desactivado"}

    saved = 0
    skipped = 0
    for sample in samples:
        label = _clean_label(sample.label)
        kind = label_kind(label)
        if kind is None or kind != sample.kind:
            skipped += 1
            continue

        payload = sample.landmarks if kind == "static" else sample.sequence
        db.add(
            TrainingSample(
                user_id=user_id,
                attempt_id=attempt_id,
                label=label,
                kind=kind,
                data_json=json.dumps([round(float(v), 6) for v in payload])
                if kind == "static"
                else json.dumps([[round(float(v), 6) for v in frame] for frame in payload]),
                predicted_label=_clean_label(sample.predicted_label or "") or None,
                confidence=float(sample.confidence or 0.0),
                verified=bool(verified),
                source=source,
            )
        )
        saved += 1

    db.commit()
    if saved:
        personal_model_service.invalidate(user_id)
    return {"saved": saved, "skipped": skipped, "verified": bool(verified)}


def verify_attempt_samples(db: Session, user_id: int, attempt_id: int, label: str) -> int:
    """El usuario confirma que hizo bien la seña: re-etiqueta y verifica."""
    label = _clean_label(label)
    rows = db.scalars(
        select(TrainingSample).where(
            TrainingSample.user_id == user_id,
            TrainingSample.attempt_id == attempt_id,
        )
    ).all()
    count = 0
    for row in rows:
        if label_kind(label) != row.kind:
            continue
        row.label = label
        row.verified = True
        count += 1
    db.commit()
    if count:
        personal_model_service.invalidate(user_id)
    return count


def stats(db: Session, user_id: int) -> dict:
    rows = db.execute(
        select(
            TrainingSample.label,
            TrainingSample.kind,
            TrainingSample.verified,
            TrainingSample.exported,
            func.count(TrainingSample.id),
        )
        .where(TrainingSample.user_id == user_id)
        .group_by(
            TrainingSample.label,
            TrainingSample.kind,
            TrainingSample.verified,
            TrainingSample.exported,
        )
    ).all()

    per_label: dict[str, dict] = {}
    totals = Counter()
    for label, kind, verified, exported, count in rows:
        item = per_label.setdefault(
            label,
            {"label": label, "kind": kind, "total": 0, "verified": 0, "exported": 0},
        )
        item["total"] += count
        totals["total"] += count
        if verified:
            item["verified"] += count
            totals["verified"] += count
        if exported:
            item["exported"] += count
            totals["exported"] += count

    community_total = db.scalar(
        select(func.count(TrainingSample.id)).where(TrainingSample.verified.is_(True))
    ) or 0

    labels = sorted(
        per_label.values(),
        key=lambda item: (item["kind"] != "static", item["label"]),
    )
    return {
        "total": totals["total"],
        "verified": totals["verified"],
        "pending": totals["total"] - totals["verified"],
        "exported": totals["exported"],
        "community_verified": int(community_total),
        "labels": labels,
        "static_labels": STATIC_LABELS,
        "dynamic_labels": DYNAMIC_LABELS,
        "personal_model": personal_model_service.status(user_id),
        "dataset_dir": str(TRAINING_DATASET_DIR),
    }


def export_samples(db: Session, user_id: int, include_exported: bool = False) -> dict:
    """Escribe muestras verificadas como .npy en ai-training/dataset/."""
    query = select(TrainingSample).where(
        TrainingSample.user_id == user_id,
        TrainingSample.verified.is_(True),
    )
    if not include_exported:
        query = query.where(TrainingSample.exported.is_(False))

    rows = db.scalars(query.order_by(TrainingSample.id.asc())).all()
    written = Counter()
    for row in rows:
        folder = TRAINING_DATASET_DIR / row.kind / row.label
        folder.mkdir(parents=True, exist_ok=True)
        data = np.asarray(json.loads(row.data_json), dtype=np.float32)
        prefix = "user" if row.kind == "static" else "user_seq"
        np.save(folder / f"{prefix}{user_id}_{row.id}.npy", data)
        row.exported = True
        written[f"{row.kind}:{row.label}"] += 1

    db.commit()
    return {
        "exported": sum(written.values()),
        "by_label": dict(written),
        "dataset_dir": str(TRAINING_DATASET_DIR),
        "next_steps": [
            "cd ai-training",
            "python training/preprocess.py && python training/train_mlp.py",
            "python training/preprocess_dynamic.py && python training/train_lstm.py",
            "python export/export_onnx.py  # y reinicia el backend",
        ],
    }


def delete_samples(db: Session, user_id: int, label: Optional[str] = None) -> int:
    query = delete(TrainingSample).where(TrainingSample.user_id == user_id)
    if label:
        query = query.where(TrainingSample.label == _clean_label(label))
    result = db.execute(query)
    db.commit()
    personal_model_service.invalidate(user_id)
    return int(result.rowcount or 0)


def recent_samples(db: Session, user_id: int, limit: int = 20) -> list[dict]:
    rows = db.scalars(
        select(TrainingSample)
        .where(TrainingSample.user_id == user_id)
        .order_by(TrainingSample.id.desc())
        .limit(max(1, min(limit, 100)))
    ).all()
    return [
        {
            "id": row.id,
            "label": row.label,
            "kind": row.kind,
            "predicted_label": row.predicted_label,
            "confidence": round(row.confidence, 4),
            "verified": bool(row.verified),
            "exported": bool(row.exported),
            "source": row.source,
            "attempt_id": row.attempt_id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]
