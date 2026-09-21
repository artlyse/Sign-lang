# Cambiar en la configuracion del detector:
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_hands=2,                # <-- CAMBIO: ahora 2 manos
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5
)

# Cambiar la extraccion de landmarks:
if result.hand_landmarks:
    landmarks = []
    # Extraer landmarks de ambas manos
    for hand in result.hand_landmarks[:2]:  # Maximo 2 manos
        for lm in hand:
            landmarks.extend([lm.x, lm.y, lm.z])
    
    # Rellenar con ceros si solo hay 1 mano
    if len(result.hand_landmarks) == 1:
        landmarks.extend([0.0] * 63)  # Rellenar segunda mano
    
    # Ahora landmarks tiene 126 valores (63 por mano)
    secuencia.append(landmarks)

# Cambiar la configuracion:
SENAS = ["AYUDAR", "CASA", "TRABAJAR", "FAMILIA", "AMIGO"]
DATASET_PATH = os.path.join(SCRIPT_DIR, "dataset", "two_hands")