"""Inferencia temporal de señas que representan palabras completas.

Recibe secuencias de 30 frames x 192 features (dos manos + pose), normaliza con
scaler_word.pkl, ejecuta word_model.onnx y aplica estabilidad/fin de gesto."""

from __future__ import annotations

import json
import os
import time
from collections import deque
from pathlib import Path
from typing import Deque, Optional

import joblib
import numpy as np
import onnxruntime as ort

from app.config import (
    WORD_EVAL_STRIDE,
    WORD_INPUT_FEATURES,
    WORD_LABELS_PATH,
    WORD_MIN_CONFIDENCE,
    WORD_MIN_GESTURE_FRAMES,
    WORD_MAX_GESTURE_FRAMES,
    WORD_MODEL_PATH,
    WORD_SAMPLE_FPS,
    WORD_SCALER_PATH,
    WORD_SEQUENCE_FRAMES,
    WORD_STABLE_CONFIRMATIONS,
)


class WordRecognitionService:
    """Carga el clasificador temporal de palabras completas."""

    def __init__(self) -> None:
        self.session: Optional[ort.InferenceSession] = None
        self.scaler = None
        self.labels: list[str] = []
        self.load_error: Optional[str] = None
        self.reload()

    def reload(self) -> None:
        self.session = None
        self.scaler = None
        self.labels = []
        self.load_error = None

        missing = [
            path
            for path in (WORD_MODEL_PATH, WORD_SCALER_PATH, WORD_LABELS_PATH)
            if not os.path.exists(path)
        ]
        if missing:
            self.load_error = (
                "Modelo de palabras aun no entrenado. Faltan: "
                + ", ".join(Path(item).name for item in missing)
            )
            print(f"ADVERTENCIA: {self.load_error}")
            return

        try:
            self.session = ort.InferenceSession(
                WORD_MODEL_PATH,
                providers=["CPUExecutionProvider"],
            )
            self.scaler = joblib.load(WORD_SCALER_PATH)
            with open(WORD_LABELS_PATH, "r", encoding="utf-8") as handle:
                labels = json.load(handle)
            self.labels = [str(item).strip().upper() for item in labels if str(item).strip()]

            if not self.labels:
                raise RuntimeError("word_labels.json no contiene etiquetas")

            print(
                "Modelo de palabras cargado: "
                f"{Path(WORD_MODEL_PATH).name} ({len(self.labels)} clases)"
            )
        except Exception as exc:
            self.load_error = str(exc)
            self.session = None
            self.scaler = None
            self.labels = []
            print(f"Error cargando modelo de palabras: {exc}")

    @property
    def available(self) -> bool:
        return bool(self.session is not None and self.scaler is not None and self.labels)

    def status(self) -> dict:
        return {
            "available": self.available,
            "labels": list(self.labels),
            "sequence_frames": WORD_SEQUENCE_FRAMES,
            "feature_dim": WORD_INPUT_FEATURES,
            "error": self.load_error,
        }

    @staticmethod
    def _softmax(logits: np.ndarray) -> np.ndarray:
        values = np.asarray(logits, dtype=np.float32)
        exp = np.exp(values - np.max(values))
        total = float(exp.sum())
        return exp / total if total > 0 else exp

    def predict(self, sequence: list[list[float]]) -> dict:
        if not self.available:
            return {
                "error": self.load_error or "Modelo de palabras no disponible",
                "mode": "word",
                "accepted": False,
            }

        seq = np.asarray(sequence, dtype=np.float32)
        expected = (WORD_SEQUENCE_FRAMES, WORD_INPUT_FEATURES)
        if seq.shape != expected:
            return {
                "error": f"Forma incorrecta {seq.shape}; se esperaba {expected}",
                "mode": "word",
                "accepted": False,
            }

        flat = seq.reshape(-1, WORD_INPUT_FEATURES)
        scaled = self.scaler.transform(flat).astype(np.float32)
        model_input = scaled.reshape(1, WORD_SEQUENCE_FRAMES, WORD_INPUT_FEATURES)

        input_name = self.session.get_inputs()[0].name
        outputs = self.session.run(None, {input_name: model_input})
        probs = self._softmax(outputs[0][0])

        idx = int(np.argmax(probs))
        confidence = float(probs[idx])
        raw_label = self.labels[idx] if idx < len(self.labels) else str(idx)
        label = raw_label.replace("_", " ").strip()

        top_idx = np.argsort(probs)[-3:][::-1]
        top3 = [
            {
                "word": (
                    self.labels[int(item)].replace("_", " ").strip()
                    if int(item) < len(self.labels)
                    else str(int(item))
                ),
                "confidence": float(probs[int(item)]),
            }
            for item in top_idx
        ]

        return {
            "word": label,
            "confidence": confidence,
            "mode": "word",
            "accepted": False,
            "top3": top3,
        }


word_recognition_service = WordRecognitionService()


class WordRecognitionSession:
    """
    Estado temporal por WebSocket para señas que representan palabras/frases.

    Hay dos caminos de aceptación:
    1) EN VIVO: una ventana rolling de 30 frames obtiene varias predicciones
       estables mientras la seña sigue visible.
    2) FIN DE GESTO: al desaparecer las manos se toma toda la ejecución,
       se remuestrea a 30 frames y se hace una última inferencia. Esto evita
       perder una palabra cuando el usuario termina justo después de completar
       los 30 frames.
    """

    def __init__(self) -> None:
        self.frames: Deque[list[float]] = deque(maxlen=WORD_SEQUENCE_FRAMES)
        self.gesture_frames: Deque[list[float]] = deque(
            maxlen=max(WORD_MAX_GESTURE_FRAMES, WORD_SEQUENCE_FRAMES)
        )
        self.last_sample_ms: Optional[float] = None
        self.frames_since_eval = 0
        self.candidate_word: Optional[str] = None
        self.candidate_confidence = 0.0
        self.candidate_top3: list[dict] = []
        self.candidate_count = 0
        self.gesture_accepted = False

    def reset(self) -> None:
        self.frames.clear()
        self.gesture_frames.clear()
        self.last_sample_ms = None
        self.frames_since_eval = 0
        self.candidate_word = None
        self.candidate_confidence = 0.0
        self.candidate_top3 = []
        self.candidate_count = 0
        self.gesture_accepted = False

    @staticmethod
    def _resample(
        frames: list[list[float]],
        length: int = WORD_SEQUENCE_FRAMES,
    ) -> list[list[float]]:
        data = np.asarray(frames, dtype=np.float32)
        if data.ndim != 2 or data.shape[1] != WORD_INPUT_FEATURES:
            raise ValueError(
                f"Secuencia invalida {data.shape}; "
                f"se esperaba (*, {WORD_INPUT_FEATURES})"
            )
        if len(data) == length:
            return data.tolist()

        positions = np.linspace(0, len(data) - 1, length)
        lower = np.floor(positions).astype(int)
        upper = np.ceil(positions).astype(int)
        alpha = (positions - lower).reshape(-1, 1)
        result = data[lower] * (1.0 - alpha) + data[upper] * alpha
        return result.astype(np.float32).tolist()

    def _base_payload(self) -> dict:
        return {
            "kind": "word_recognition",
            "mode": "word",
            "word": self.candidate_word or "-",
            "confidence": float(self.candidate_confidence),
            "accepted": False,
            "buffer": len(self.frames),
            "gesture_frames": len(self.gesture_frames),
            "top3": list(self.candidate_top3),
        }

    def process(
        self,
        features: list,
        timestamp_ms: Optional[float] = None,
    ) -> dict:
        status = word_recognition_service.status()
        if not status["available"]:
            return {
                "kind": "word_recognition",
                "mode": "word",
                "word": "-",
                "confidence": 0.0,
                "accepted": False,
                "status": status,
                "error": (
                    status.get("error")
                    or "Modelo de palabras no disponible"
                ),
            }

        if len(features) != WORD_INPUT_FEATURES:
            return {
                "kind": "word_recognition",
                "mode": "word",
                "word": "-",
                "confidence": 0.0,
                "accepted": False,
                "error": (
                    f"Se esperaban {WORD_INPUT_FEATURES} caracteristicas; "
                    f"se recibieron {len(features)}"
                ),
            }

        now_ms = float(
            timestamp_ms
            if timestamp_ms is not None
            else time.monotonic() * 1000.0
        )
        min_interval_ms = 1000.0 / max(WORD_SAMPLE_FPS, 1)

        if (
            self.last_sample_ms is not None
            and now_ms - self.last_sample_ms < min_interval_ms
        ):
            return self._base_payload()

        self.last_sample_ms = now_ms
        frame = [float(item) for item in features]
        self.frames.append(frame)
        self.gesture_frames.append(frame)
        self.frames_since_eval += 1

        payload = self._base_payload()
        if len(self.frames) < WORD_SEQUENCE_FRAMES:
            return payload

        if self.frames_since_eval < WORD_EVAL_STRIDE:
            return payload

        self.frames_since_eval = 0
        result = word_recognition_service.predict(list(self.frames))
        if "error" in result:
            return {"kind": "word_recognition", **result}

        word = str(result.get("word", "-")).upper()
        confidence = float(result.get("confidence", 0.0))
        previous_candidate = self.candidate_word
        self.candidate_confidence = confidence
        self.candidate_top3 = list(result.get("top3") or [])

        # Una ejecución física solo puede insertar una palabra/frase.
        if self.gesture_accepted:
            if word and word != "-":
                self.candidate_word = word
            result["accepted"] = False
            result["buffer"] = len(self.frames)
            result["gesture_frames"] = len(self.gesture_frames)
            return {"kind": "word_recognition", **result}

        if confidence < WORD_MIN_CONFIDENCE:
            # La predicción de baja confianza se conserva para depuración/UI,
            # pero no suma confirmaciones.
            if word and word != "-":
                self.candidate_word = word
            self.candidate_count = 0
            result["accepted"] = False
            result["buffer"] = len(self.frames)
            result["gesture_frames"] = len(self.gesture_frames)
            return {"kind": "word_recognition", **result}

        if word != previous_candidate:
            self.candidate_count = 1
        else:
            self.candidate_count += 1
        self.candidate_word = word

        accepted = (
            self.candidate_count >= WORD_STABLE_CONFIRMATIONS
            and not self.gesture_accepted
        )

        if accepted:
            self.gesture_accepted = True
            self.candidate_count = 0

        result["accepted"] = accepted
        result["buffer"] = len(self.frames)
        result["gesture_frames"] = len(self.gesture_frames)
        result["confirmations"] = self.candidate_count
        result["source"] = "live"
        return {"kind": "word_recognition", **result}

    def finalize_gesture(self) -> Optional[dict]:
        """
        Se ejecuta cuando las manos dejan de estar visibles.

        Si la seña ya fue aceptada en vivo, solo limpia el estado. Si todavía
        no fue aceptada, remuestrea toda la ejecución y hace una inferencia
        final. Esto se parece mucho más a cómo se capturó el dataset.
        """
        snapshot = list(self.gesture_frames)
        already_accepted = self.gesture_accepted

        if already_accepted:
            self.reset()
            return None

        if len(snapshot) < max(1, WORD_MIN_GESTURE_FRAMES):
            result = {
                "kind": "word_recognition",
                "mode": "word",
                "word": self.candidate_word or "-",
                "confidence": float(self.candidate_confidence),
                "accepted": False,
                "buffer": len(self.frames),
                "gesture_frames": len(snapshot),
                "top3": list(self.candidate_top3),
                "source": "gesture_end",
                "reason": "gesture_too_short",
            }
            self.reset()
            return result

        try:
            sequence = self._resample(snapshot)
            result = word_recognition_service.predict(sequence)
            if "error" in result:
                payload = {"kind": "word_recognition", **result}
                self.reset()
                return payload

            confidence = float(result.get("confidence", 0.0))
            result["accepted"] = confidence >= WORD_MIN_CONFIDENCE
            result["buffer"] = WORD_SEQUENCE_FRAMES
            result["gesture_frames"] = len(snapshot)
            result["source"] = "gesture_end"
            result["reason"] = (
                "gesture_finalized"
                if result["accepted"]
                else "low_confidence"
            )
            return {"kind": "word_recognition", **result}
        finally:
            self.reset()

