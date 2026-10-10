"""Extracción de features para el modo Palabra.

Debe permanecer matemáticamente alineada con `frontend/src/services/wordVision.ts`.
Cada frame produce 192 valores: mano izquierda, mano derecha y pose superior."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

WORD_FEATURE_DIM = 192
WORD_SEQUENCE_FRAMES = 30
POSE_INDEXES = [
    0,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
]


@dataclass
class DetectionBundle:
    features: np.ndarray
    hand_result: object
    pose_result: object


def _xyz(point):
    return float(point.x), float(point.y), float(point.z)


def _distance3(a, b) -> float:
    ax, ay, az = _xyz(a)
    bx, by, bz = _xyz(b)
    return float(np.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2))


def _body_reference(pose_landmarks):
    if pose_landmarks and len(pose_landmarks) > 12:
        left = pose_landmarks[11]
        right = pose_landmarks[12]
        scale = max(_distance3(left, right), 0.08)
        center = np.asarray(
            [
                (left.x + right.x) / 2.0,
                (left.y + right.y) / 2.0,
                (left.z + right.z) / 2.0,
            ],
            dtype=np.float32,
        )
        return center, float(scale)

    return np.asarray([0.5, 0.5, 0.0], dtype=np.float32), 1.0


def _hand_features(landmarks, center: np.ndarray, body_scale: float) -> list[float]:
    if not landmarks or len(landmarks) != 21:
        return [0.0] * 66

    wrist = landmarks[0]
    local_scale = max((_distance3(point, wrist) for point in landmarks), default=0.04)
    local_scale = max(float(local_scale), 0.04)

    local = []
    for point in landmarks:
        local.extend(
            [
                (float(point.x) - float(wrist.x)) / local_scale,
                (float(point.y) - float(wrist.y)) / local_scale,
                (float(point.z) - float(wrist.z)) / local_scale,
            ]
        )

    global_wrist = [
        (float(wrist.x) - float(center[0])) / body_scale,
        (float(wrist.y) - float(center[1])) / body_scale,
        (float(wrist.z) - float(center[2])) / body_scale,
    ]
    return local + global_wrist


def _pose_features(pose_landmarks, center: np.ndarray, body_scale: float) -> list[float]:
    if not pose_landmarks or len(pose_landmarks) < 25:
        return [0.0] * (len(POSE_INDEXES) * 4)

    output = []
    for index in POSE_INDEXES:
        point = pose_landmarks[index]
        output.extend(
            [
                (float(point.x) - float(center[0])) / body_scale,
                (float(point.y) - float(center[1])) / body_scale,
                (float(point.z) - float(center[2])) / body_scale,
                float(getattr(point, "visibility", 1.0) or 0.0),
            ]
        )
    return output


def _handedness_label(hand_result, index: int) -> str:
    try:
        category = hand_result.handedness[index][0]
        value = getattr(category, "category_name", None) or getattr(category, "display_name", None)
        return str(value or "").lower()
    except Exception:
        return ""


def build_features(hand_result, pose_result) -> np.ndarray:
    pose = pose_result.pose_landmarks[0] if getattr(pose_result, "pose_landmarks", None) else None
    center, body_scale = _body_reference(pose)

    left = None
    right = None
    unassigned = []
    hands = list(getattr(hand_result, "hand_landmarks", None) or [])

    for index, hand in enumerate(hands):
        label = _handedness_label(hand_result, index)
        if "left" in label:
            left = hand
        elif "right" in label:
            right = hand
        else:
            unassigned.append(hand)

    for hand in unassigned:
        wrist_x = float(hand[0].x) if hand else 0.5
        if left is None and wrist_x < float(center[0]):
            left = hand
        elif right is None:
            right = hand
        elif left is None:
            left = hand

    features = (
        _hand_features(left, center, body_scale)
        + _hand_features(right, center, body_scale)
        + _pose_features(pose, center, body_scale)
    )

    array = np.asarray(features, dtype=np.float32)
    if array.shape != (WORD_FEATURE_DIM,):
        raise RuntimeError(
            f"Vector invalido {array.shape}; se esperaba ({WORD_FEATURE_DIM},)"
        )
    return array


class WordFeatureExtractor:
    def __init__(self, hand_model: Path, pose_model: Path):
        vision = mp.tasks.vision
        running_mode = vision.RunningMode.VIDEO

        self.hand = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(hand_model)),
                running_mode=running_mode,
                num_hands=2,
                min_hand_detection_confidence=0.45,
                min_hand_presence_confidence=0.45,
                min_tracking_confidence=0.45,
            )
        )
        self.pose = vision.PoseLandmarker.create_from_options(
            vision.PoseLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(pose_model)),
                running_mode=running_mode,
                num_poses=1,
                min_pose_detection_confidence=0.45,
                min_pose_presence_confidence=0.45,
                min_tracking_confidence=0.45,
                output_segmentation_masks=False,
            )
        )

    def close(self):
        self.hand.close()
        self.pose.close()

    def process(self, frame_bgr: np.ndarray, timestamp_ms: int) -> Optional[DetectionBundle]:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        hand_result = self.hand.detect_for_video(mp_image, int(timestamp_ms))
        pose_result = self.pose.detect_for_video(mp_image, int(timestamp_ms))

        # Para el modelo de palabras requerimos al menos una mano. Pose puede
        # faltar puntualmente y en ese caso el vector de pose se rellena con 0.
        if not getattr(hand_result, "hand_landmarks", None):
            return None

        features = build_features(hand_result, pose_result)
        return DetectionBundle(features, hand_result, pose_result)


def draw_debug(frame: np.ndarray, bundle: Optional[DetectionBundle]) -> np.ndarray:
    if bundle is None:
        return frame

    h, w = frame.shape[:2]

    for hand in list(getattr(bundle.hand_result, "hand_landmarks", None) or []):
        for point in hand:
            cv2.circle(
                frame,
                (int(point.x * w), int(point.y * h)),
                3,
                (0, 220, 0),
                -1,
            )

    poses = list(getattr(bundle.pose_result, "pose_landmarks", None) or [])
    if poses:
        pose = poses[0]
        for index in POSE_INDEXES:
            point = pose[index]
            if float(getattr(point, "visibility", 1.0) or 0.0) < 0.35:
                continue
            cv2.circle(
                frame,
                (int(point.x * w), int(point.y * h)),
                3,
                (255, 170, 0),
                -1,
            )

    return frame


def resample_sequence(frames: list[np.ndarray], length: int = WORD_SEQUENCE_FRAMES) -> np.ndarray:
    if not frames:
        raise ValueError("No hay frames validos para crear la secuencia")

    data = np.asarray(frames, dtype=np.float32)
    if len(data) == length:
        return data

    positions = np.linspace(0, len(data) - 1, length)
    lower = np.floor(positions).astype(int)
    upper = np.ceil(positions).astype(int)
    alpha = (positions - lower).reshape(-1, 1)
    return (data[lower] * (1.0 - alpha) + data[upper] * alpha).astype(np.float32)
