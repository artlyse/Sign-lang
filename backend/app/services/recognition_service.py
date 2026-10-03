import os

import joblib
import numpy as np
import onnxruntime as ort

from app.config import (
    GESTURE_MODEL_PATH,
    LSTM_MODEL_PATH,
    SCALER_STATIC_PATH,
    SCALER_DYNAMIC_PATH,
    LETRAS_STATIC,
    SENAS_DYNAMIC,
)

# Tus datasets fueron normalizados antes de entrenar.
# Mantener True para que la inferencia use el mismo preprocesamiento.
USE_NORMALIZATION = True


class RecognitionService:
    def __init__(self):
        self.static_session = None
        self.dynamic_session = None
        self.scaler_static = None
        self.scaler_dynamic = None
        self._load_models()

    def _load_models(self):
        try:
            if os.path.exists(GESTURE_MODEL_PATH):
                self.static_session = ort.InferenceSession(
                    GESTURE_MODEL_PATH,
                    providers=["CPUExecutionProvider"],
                )
                print(f"Modelo estatico cargado: {GESTURE_MODEL_PATH}")
            else:
                print(f"ADVERTENCIA: No se encontro {GESTURE_MODEL_PATH}")

            if os.path.exists(LSTM_MODEL_PATH):
                self.dynamic_session = ort.InferenceSession(
                    LSTM_MODEL_PATH,
                    providers=["CPUExecutionProvider"],
                )
                print(f"Modelo dinamico cargado: {LSTM_MODEL_PATH}")
            else:
                print(f"ADVERTENCIA: No se encontro {LSTM_MODEL_PATH}")

            if os.path.exists(SCALER_STATIC_PATH):
                self.scaler_static = joblib.load(SCALER_STATIC_PATH)
                print("Scaler estatico cargado")
            else:
                print(f"ADVERTENCIA: No se encontro {SCALER_STATIC_PATH}")

            if os.path.exists(SCALER_DYNAMIC_PATH):
                self.scaler_dynamic = joblib.load(SCALER_DYNAMIC_PATH)
                print("Scaler dinamico cargado")
            else:
                print(f"ADVERTENCIA: No se encontro {SCALER_DYNAMIC_PATH}")

        except Exception as e:
            print(f"Error cargando modelos: {e}")

    def normalize_landmarks(self, landmarks: list) -> list:
        """Normaliza 21 landmarks respecto a la muneca (landmark 0)."""
        pts = np.asarray(landmarks, dtype=np.float32).reshape(21, 3)
        pts = pts - pts[0]

        max_dist = np.max(np.linalg.norm(pts, axis=1))
        if max_dist > 0:
            pts = pts / max_dist

        return pts.flatten().tolist()

    def _softmax(self, logits):
        logits = np.asarray(logits, dtype=np.float32)
        exp = np.exp(logits - np.max(logits))
        return exp / exp.sum()

    def predict_static(self, landmarks: list) -> dict:
        if self.static_session is None or self.scaler_static is None:
            return {"error": "Modelo estatico no disponible"}

        if len(landmarks) != 63:
            return {
                "error": f"Se esperaban 63 valores, se recibieron {len(landmarks)}"
            }

        processed_landmarks = landmarks
        if USE_NORMALIZATION:
            processed_landmarks = self.normalize_landmarks(processed_landmarks)

        X = np.asarray(processed_landmarks, dtype=np.float32).reshape(1, -1)
        X = self.scaler_static.transform(X).astype(np.float32)

        input_name = self.static_session.get_inputs()[0].name
        outputs = self.static_session.run(None, {input_name: X})

        probs = self._softmax(outputs[0][0])
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])

        top3_idx = np.argsort(probs)[-3:][::-1]
        top3 = [
            {
                "letter": LETRAS_STATIC[int(i)],
                "confidence": float(probs[int(i)]),
            }
            for i in top3_idx
        ]

        return {
            "letter": LETRAS_STATIC[idx],
            "confidence": confidence,
            "mode": "static",
            "top3": top3,
        }

    def predict_dynamic(self, sequence: list) -> dict:
        if self.dynamic_session is None or self.scaler_dynamic is None:
            return {"error": "Modelo dinamico no disponible"}

        if len(sequence) != 30:
            return {
                "error": f"Se esperaban 30 frames, se recibieron {len(sequence)}"
            }

        seq = np.asarray(sequence, dtype=np.float32)
        if seq.shape != (30, 63):
            return {
                "error": f"Forma incorrecta: {seq.shape}, se esperaba (30, 63)"
            }

        if USE_NORMALIZATION:
            normalized = [self.normalize_landmarks(frame) for frame in sequence]
            seq = np.asarray(normalized, dtype=np.float32)

        flat = seq.reshape(-1, 63)
        flat = self.scaler_dynamic.transform(flat).astype(np.float32)
        seq = flat.reshape(1, 30, 63)

        input_name = self.dynamic_session.get_inputs()[0].name
        outputs = self.dynamic_session.run(None, {input_name: seq})

        probs = self._softmax(outputs[0][0])
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])

        top3_idx = np.argsort(probs)[-3:][::-1]
        top3 = [
            {
                "letter": SENAS_DYNAMIC[int(i)],
                "confidence": float(probs[int(i)]),
            }
            for i in top3_idx
        ]

        return {
            "letter": SENAS_DYNAMIC[idx],
            "confidence": confidence,
            "mode": "dynamic",
            "top3": top3,
        }


recognition_service = RecognitionService()
