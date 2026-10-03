import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "hand_landmarker.task")

base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_hands=1,
    min_hand_detection_confidence=0.5
)
detector = vision.HandLandmarker.create_from_options(options)

cap = cv2.VideoCapture(0)
print("Capturando landmarks desde Python (camara laptop)...")
print("Muestra la letra A y presiona ESPACIO")

while True:
    ret, frame = cap.read()
    if not ret: break
    frame = cv2.flip(frame, 1)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = detector.detect(mp_image)
    
    if result.hand_landmarks:
        hand = result.hand_landmarks[0]
        h, w = frame.shape[:2]
        for lm in hand:
            x, y = int(lm.x * w), int(lm.y * h)
            cv2.circle(frame, (x, y), 3, (0, 0, 255), -1)
    
    cv2.imshow('Python - ESPACIO para capturar', frame)
    key = cv2.waitKey(1) & 0xFF
    if key == 32 and result.hand_landmarks:
        flat = []
        for lm in result.hand_landmarks[0]:
            flat.extend([lm.x, lm.y, lm.z])
        print("Landmarks Python (primeros 6):", flat[:6])
        print("Landmarks Python (61-63):", flat[-3:])
        print("Min:", min(flat), "Max:", max(flat))
        np.save("landmarks_python.npy", np.array(flat))
        print("Guardado en landmarks_python.npy")
    elif key == 27:
        break

cap.release()
cv2.destroyAllWindows()