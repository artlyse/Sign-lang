import time
from collections import Counter, deque
from typing import Deque, Optional, Tuple

import numpy as np

from app.config import (
    HYBRID_BLOCK_STATIC_DYNAMIC_LETTERS,
    HYBRID_DYNAMIC_CONFIDENCE,
    HYBRID_DYNAMIC_CONFIRMATIONS,
    HYBRID_DYNAMIC_EVAL_STRIDE,
    HYBRID_DYNAMIC_HOLD_FRAMES,
    HYBRID_DYNAMIC_SAMPLE_INTERVAL_MS,
    HYBRID_MOTION_THRESHOLD,
    HYBRID_SEQUENCE_FRAMES,
    HYBRID_SPREAD_THRESHOLD,
    HYBRID_STATIC_MIN_CONFIDENCE,
    HYBRID_STATIC_MIN_VOTES,
    HYBRID_STATIC_VOTE_WINDOW,
)
from app.services.recognition_service import recognition_service


class HybridRecognitionSession:
    """
    Reconocimiento híbrido desacoplado:

    - El MLP estático procesa cada frame recibido.
    - El LSTM dinámico toma muestras por tiempo real (~15 Hz), no por cantidad
      de mensajes. Esto evita que la latencia del WebSocket cambie la velocidad
      temporal que ve el LSTM.
    """

    FINGERTIPS = (8, 12, 16, 20)

    def __init__(self):
        self.sequence: Deque[list] = deque(maxlen=HYBRID_SEQUENCE_FRAMES)
        self.dynamic_votes: Deque[Tuple[str, float]] = deque(
            maxlen=HYBRID_DYNAMIC_CONFIRMATIONS
        )
        self.static_votes: Deque[Tuple[str, float]] = deque(
            maxlen=HYBRID_STATIC_VOTE_WINDOW
        )

        self.frames_since_dynamic_eval = 0
        self.last_dynamic_sample_ms: Optional[float] = None

        self.locked_letter: Optional[str] = None
        self.locked_confidence = 0.0
        self.lock_frames_remaining = 0

    def reset(self):
        self.sequence.clear()
        self.dynamic_votes.clear()
        self.static_votes.clear()
        self.frames_since_dynamic_eval = 0
        self.last_dynamic_sample_ms = None
        self.locked_letter = None
        self.locked_confidence = 0.0
        self.lock_frames_remaining = 0

    def _sanitize_static_result(self, result: dict) -> dict:
        if "error" in result:
            return result

        if result.get("letter") not in HYBRID_BLOCK_STATIC_DYNAMIC_LETTERS:
            return result

        # J y Z no fueron entrenadas como estáticas. Si aparecen, usamos la
        # siguiente clase válida del top-3 para que no contaminen la salida.
        for candidate in result.get("top3", []):
            if candidate["letter"] not in HYBRID_BLOCK_STATIC_DYNAMIC_LETTERS:
                cleaned = dict(result)
                cleaned["letter"] = candidate["letter"]
                cleaned["confidence"] = candidate["confidence"]
                return cleaned

        cleaned = dict(result)
        cleaned["letter"] = "-"
        cleaned["confidence"] = 0.0
        return cleaned

    def _smooth_static(self, result: dict) -> dict:
        letter = str(result.get("letter", "-"))
        confidence = float(result.get("confidence", 0.0))

        if letter != "-" and confidence >= HYBRID_STATIC_MIN_CONFIDENCE:
            self.static_votes.append((letter, confidence))
        else:
            self.static_votes.append(("-", 0.0))

        valid_votes = [
            (item_letter, item_conf)
            for item_letter, item_conf in self.static_votes
            if item_letter != "-"
        ]

        # Durante los primeros frames devolvemos el resultado bruto; así el
        # usuario sigue viendo una letra inmediatamente.
        if len(valid_votes) < HYBRID_STATIC_MIN_VOTES:
            return result

        counts = Counter(item_letter for item_letter, _ in valid_votes)
        winner, votes = counts.most_common(1)[0]

        if votes < HYBRID_STATIC_MIN_VOTES:
            return result

        winner_confidences = [
            conf for item_letter, conf in valid_votes if item_letter == winner
        ]

        smoothed = dict(result)
        smoothed["letter"] = winner
        smoothed["confidence"] = float(np.mean(winner_confidences))
        smoothed["static_votes"] = votes
        return smoothed

    def _normalized_sequence(self) -> np.ndarray:
        normalized = [
            recognition_service.normalize_landmarks(frame)
            for frame in self.sequence
        ]
        return np.asarray(normalized, dtype=np.float32).reshape(
            HYBRID_SEQUENCE_FRAMES, 21, 3
        )

    def _motion_metrics(self) -> Tuple[float, float]:
        if len(self.sequence) < HYBRID_SEQUENCE_FRAMES:
            return 0.0, 0.0

        seq = self._normalized_sequence()
        fingertips = seq[:, self.FINGERTIPS, :]
        frame_deltas = np.linalg.norm(np.diff(fingertips, axis=0), axis=2)
        movement_score = float(frame_deltas.mean())
        spread_per_finger = np.linalg.norm(fingertips.std(axis=0), axis=1)
        trajectory_spread = float(spread_per_finger.mean())
        return movement_score, trajectory_spread

    @staticmethod
    def _movement_is_dynamic(movement: float, spread: float) -> bool:
        return (
            movement >= HYBRID_MOTION_THRESHOLD
            and spread >= HYBRID_SPREAD_THRESHOLD
        )

    def _locked_response(self, static_result: dict) -> dict:
        self.lock_frames_remaining -= 1

        response = {
            "letter": self.locked_letter,
            "confidence": self.locked_confidence,
            "mode": "dynamic",
            "movement": 0.0,
            "trajectory_spread": 0.0,
            "buffer_frames": len(self.sequence),
            "static": {
                "letter": static_result.get("letter", "-"),
                "confidence": float(static_result.get("confidence", 0.0)),
            },
            "dynamic": {
                "letter": self.locked_letter,
                "confidence": self.locked_confidence,
                "confirmed": True,
            },
        }

        if self.lock_frames_remaining <= 0:
            self.locked_letter = None
            self.locked_confidence = 0.0
            self.lock_frames_remaining = 0
            self.sequence.clear()
            self.dynamic_votes.clear()
            self.frames_since_dynamic_eval = 0
            self.last_dynamic_sample_ms = None

        return response

    def _should_sample_dynamic(self, timestamp_ms: float) -> bool:
        if self.last_dynamic_sample_ms is None:
            self.last_dynamic_sample_ms = timestamp_ms
            return True

        elapsed = timestamp_ms - self.last_dynamic_sample_ms

        # Tolerancia para jitter de requestAnimationFrame / WebSocket.
        if elapsed >= HYBRID_DYNAMIC_SAMPLE_INTERVAL_MS * 0.85:
            self.last_dynamic_sample_ms = timestamp_ms
            return True

        return False

    def process(self, landmarks: list, timestamp_ms: Optional[float] = None) -> dict:
        if len(landmarks) != 63:
            return {
                "error": f"Se esperaban 63 valores, se recibieron {len(landmarks)}"
            }

        # 1) El estático corre para cada frame recibido.
        static_result = recognition_service.predict_static(landmarks)
        if "error" in static_result:
            return static_result

        static_result = self._sanitize_static_result(static_result)
        static_result = self._smooth_static(static_result)

        # 2) Una dinámica confirmada mantiene prioridad brevemente.
        if self.lock_frames_remaining > 0 and self.locked_letter is not None:
            return self._locked_response(static_result)

        # 3) El LSTM se alimenta por reloj real (~15 Hz).
        if timestamp_ms is None:
            timestamp_ms = time.monotonic() * 1000.0
        else:
            try:
                timestamp_ms = float(timestamp_ms)
            except (TypeError, ValueError):
                timestamp_ms = time.monotonic() * 1000.0

        movement = 0.0
        spread = 0.0
        dynamic_result = None

        if self._should_sample_dynamic(timestamp_ms):
            self.sequence.append([float(v) for v in landmarks])
            self.frames_since_dynamic_eval += 1

            if len(self.sequence) == HYBRID_SEQUENCE_FRAMES:
                movement, spread = self._motion_metrics()
                movement_ok = self._movement_is_dynamic(movement, spread)

                if not movement_ok:
                    self.dynamic_votes.clear()
                elif self.frames_since_dynamic_eval >= HYBRID_DYNAMIC_EVAL_STRIDE:
                    self.frames_since_dynamic_eval = 0
                    dynamic_result = recognition_service.predict_dynamic(
                        list(self.sequence)
                    )

                    if "error" not in dynamic_result:
                        letter = dynamic_result["letter"]
                        confidence = float(dynamic_result["confidence"])

                        if confidence >= HYBRID_DYNAMIC_CONFIDENCE:
                            self.dynamic_votes.append((letter, confidence))
                        else:
                            self.dynamic_votes.clear()

                        if len(self.dynamic_votes) == HYBRID_DYNAMIC_CONFIRMATIONS:
                            letters = [vote[0] for vote in self.dynamic_votes]
                            if len(set(letters)) == 1:
                                avg_confidence = float(
                                    np.mean(
                                        [vote[1] for vote in self.dynamic_votes]
                                    )
                                )
                                self.locked_letter = letters[0]
                                self.locked_confidence = avg_confidence
                                self.lock_frames_remaining = (
                                    HYBRID_DYNAMIC_HOLD_FRAMES
                                )
                                self.sequence.clear()
                                self.dynamic_votes.clear()
                                self.frames_since_dynamic_eval = 0
                                self.last_dynamic_sample_ms = None
                                return self._locked_response(static_result)

        return {
            "letter": static_result.get("letter", "-"),
            "confidence": float(static_result.get("confidence", 0.0)),
            "mode": "static",
            "movement": movement,
            "trajectory_spread": spread,
            "buffer_frames": len(self.sequence),
            "static": {
                "letter": static_result.get("letter", "-"),
                "confidence": float(static_result.get("confidence", 0.0)),
                "votes": static_result.get("static_votes"),
            },
            "dynamic": (
                {
                    "letter": dynamic_result.get("letter"),
                    "confidence": float(dynamic_result.get("confidence", 0.0)),
                    "confirmed": False,
                }
                if dynamic_result and "error" not in dynamic_result
                else None
            ),
        }
