import os
from typing import List, Optional

import joblib
import numpy as np
from sklearn.linear_model import SGDClassifier

from app.config import (
    LANGUAGE_ML_DIR,
    LANGUAGE_RANKER_MAX_WEIGHT,
    LANGUAGE_RANKER_MODEL_PATH,
    LANGUAGE_RANKER_WARMUP_FEEDBACK,
)
from app.services.learning_service import learning_service


FEATURE_NAMES = [
    "similarity",
    "frequency",
    "static_context",
    "learned_context",
    "learned_confusion",
    "first_letter_match",
    "prefix_ratio",
    "suffix_ratio",
    "length_similarity",
    "dictionary",
    "completion",
    "exact",
    "base_score",
]


class CandidateRanker:
    """Ranker global incremental. Los ejemplos de entrenamiento se auditan en SQL."""

    def __init__(self):
        os.makedirs(str(LANGUAGE_ML_DIR), exist_ok=True)
        self.model: Optional[SGDClassifier] = None
        self.is_fitted = False
        self.trained_feedback = 0
        self.positive_examples = 0
        self.negative_examples = 0
        self._load_model()
        print(
            "CandidateRanker listo: "
            f"{'entrenado' if self.is_fitted else 'sin entrenar'}; "
            f"feedback={self.trained_feedback}"
        )

    @staticmethod
    def vector_from_features(features: dict) -> List[float]:
        return [
            max(0.0, min(float(features.get(name, 0.0)), 1.0))
            for name in FEATURE_NAMES
        ]

    @staticmethod
    def _new_model() -> SGDClassifier:
        return SGDClassifier(
            loss="log_loss",
            penalty="l2",
            alpha=0.001,
            learning_rate="optimal",
            average=True,
            random_state=42,
        )

    def _load_model(self) -> None:
        if not os.path.exists(LANGUAGE_RANKER_MODEL_PATH):
            return
        try:
            payload = joblib.load(LANGUAGE_RANKER_MODEL_PATH)
            if not isinstance(payload, dict):
                return
            if payload.get("feature_names") != FEATURE_NAMES:
                return
            self.model = payload.get("model")
            self.is_fitted = bool(payload.get("is_fitted", False))
            self.trained_feedback = int(payload.get("trained_feedback", 0))
            self.positive_examples = int(payload.get("positive_examples", 0))
            self.negative_examples = int(payload.get("negative_examples", 0))
        except Exception as exc:
            print(f"ADVERTENCIA cargando CandidateRanker: {exc}")
            self.model = None
            self.is_fitted = False

    def _save_model(self) -> None:
        if self.model is None:
            return
        joblib.dump(
            {
                "feature_names": FEATURE_NAMES,
                "model": self.model,
                "is_fitted": self.is_fitted,
                "trained_feedback": self.trained_feedback,
                "positive_examples": self.positive_examples,
                "negative_examples": self.negative_examples,
            },
            LANGUAGE_RANKER_MODEL_PATH,
        )

    def effective_weight(self) -> float:
        if not self.is_fitted or self.trained_feedback <= 0:
            return 0.0
        progress = min(
            1.0,
            self.trained_feedback / max(float(LANGUAGE_RANKER_WARMUP_FEEDBACK), 1.0),
        )
        return float(LANGUAGE_RANKER_MAX_WEIGHT) * progress

    def predict_probability(self, features: dict) -> Optional[float]:
        if not self.is_fitted or self.model is None:
            return None
        vector = np.asarray([self.vector_from_features(features)], dtype=np.float64)
        try:
            probabilities = self.model.predict_proba(vector)[0]
            positive_index = list(self.model.classes_).index(1)
            return float(probabilities[positive_index])
        except Exception as exc:
            print(f"ADVERTENCIA CandidateRanker predict: {exc}")
            return None

    def learn_feedback(self, examples: List[dict], feedback_id: str) -> dict:
        clean = []
        has_positive = False
        has_negative = False

        for item in examples:
            label = 1 if int(item.get("label", 0)) == 1 else 0
            vector = self.vector_from_features(item.get("features") or {})
            clean.append({"vector": vector, "label": label, "word": str(item.get("word", ""))})
            has_positive = has_positive or label == 1
            has_negative = has_negative or label == 0

        if not clean or not has_positive or not has_negative:
            return {"trained": False, "reason": "faltan ejemplos positivos/negativos"}

        # Persistencia de dataset de entrenamiento en SQL.
        learning_service.store_ranker_examples(feedback_id, clean)

        X = np.asarray([item["vector"] for item in clean], dtype=np.float64)
        y = np.asarray([item["label"] for item in clean], dtype=np.int64)
        negative_count = max(1, int(np.sum(y == 0)))
        sample_weight = np.asarray(
            [1.0 if label == 1 else 1.0 / negative_count for label in y],
            dtype=np.float64,
        )

        if self.model is None:
            self.model = self._new_model()

        try:
            if not self.is_fitted:
                self.model.partial_fit(
                    X,
                    y,
                    classes=np.asarray([0, 1], dtype=np.int64),
                    sample_weight=sample_weight,
                )
                self.is_fitted = True
            else:
                self.model.partial_fit(X, y, sample_weight=sample_weight)

            self.trained_feedback += 1
            self.positive_examples += int(np.sum(y == 1))
            self.negative_examples += int(np.sum(y == 0))
            self._save_model()
            return {
                "trained": True,
                "trained_feedback": self.trained_feedback,
                "examples": len(clean),
                "effective_weight": round(self.effective_weight(), 4),
            }
        except Exception as exc:
            print(f"ADVERTENCIA entrenando CandidateRanker: {exc}")
            return {"trained": False, "reason": str(exc)}

    def stats(self) -> dict:
        return {
            "fitted": self.is_fitted,
            "trained_feedback": self.trained_feedback,
            "positive_examples": self.positive_examples,
            "negative_examples": self.negative_examples,
            "effective_weight": round(self.effective_weight(), 4),
            "max_weight": float(LANGUAGE_RANKER_MAX_WEIGHT),
            "warmup_feedback": int(LANGUAGE_RANKER_WARMUP_FEEDBACK),
        }


candidate_ranker = CandidateRanker()
