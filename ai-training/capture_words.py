import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import os
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "hand_landmarker.task")
DATASET_PATH = os.path.join(SCRIPT_DIR, "dataset", "words")

# Palabras a capturar
PALABRAS = ["HOLA", "GRACIAS", "POR_FAVOR", "SI", "NO", "BUENOS_DIAS", "ADIOS"]
SECUENCIAS_POR_PALABRA = 50
FRAMES_POR_SECUENCIA = 50
FPS_GRABACION = 15

# CONFIGURACION DE CAMARA
CAMERA_INDEX = 1
CAMERA_BACKEND = cv2.CAP_DSHOW
CAMERA_WIDTH = 1280
CAMERA_HEIGHT = 720


def abrir_camara():
    print(f"Abriendo camara indice {CAMERA_INDEX}...")
    cap = cv2.VideoCapture(CAMERA_INDEX, CAMERA_BACKEND)
    
    if not cap.isOpened():
        print(f"Fallo con backend {CAMERA_BACKEND}. Intentando default...")
        cap = cv2.VideoCapture(CAMERA_INDEX)
    
    if not cap.isOpened():
        print(f"No se pudo abrir la camara en indice {CAMERA_INDEX}")
        return None
    
    if CAMERA_WIDTH and CAMERA_HEIGHT:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
    
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Camara abierta: {w}x{h}")
    
    return cap


def main():
    if not os.path.exists(MODEL_PATH):
        print("ERROR: No se encuentra hand_landmarker.task")
        return
    
    for palabra in PALABRAS:
        os.makedirs(os.path.join(DATASET_PATH, palabra), exist_ok=True)
    
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )
    detector = vision.HandLandmarker.create_from_options(options)
    
    cap = abrir_camara()
    if cap is None:
        return
    
    cv2.namedWindow('Captura Palabras', cv2.WINDOW_NORMAL)
    cv2.resizeWindow('Captura Palabras', 960, 540)
    
    print("=" * 60)
    print("CAPTURA DE PALABRAS COMPLETAS")
    print("=" * 60)
    print(f"Palabras: {PALABRAS}")
    print(f"Secuencias por palabra: {SECUENCIAS_POR_PALABRA}")
    print(f"Frames por secuencia: {FRAMES_POR_SECUENCIA}")
    print("=" * 60)
    
    for palabra in PALABRAS:
        print(f"\n--- PALABRA: {palabra} ---")
        
        for num_secuencia in range(SECUENCIAS_POR_PALABRA):
            print(f"Secuencia {num_secuencia + 1}/{SECUENCIAS_POR_PALABRA}")
            
            saltar = False
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frame = cv2.flip(frame, 1)
                cv2.putText(frame, f"{palabra} | Sec: {num_secuencia+1}/{SECUENCIAS_POR_PALABRA}",
                           (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                cv2.putText(frame, "ESPACIO = grabar | Q = saltar | ESC = salir",
                           (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                cv2.imshow('Captura Palabras', frame)
                
                key = cv2.waitKey(1) & 0xFF
                if key == 32:
                    break
                elif key == ord('q'):
                    saltar = True
                    break
                elif key == 27:
                    cap.release()
                    cv2.destroyAllWindows()
                    detector.close()
                    return
            
            if saltar:
                break
            
            secuencia = []
            frames_sin_mano = 0
            
            for i in range(FRAMES_POR_SECUENCIA):
                ret, frame = cap.read()
                if not ret:
                    break
                
                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                result = detector.detect(mp_image)
                
                if result.hand_landmarks:
                    landmarks = []
                    for lm in result.hand_landmarks[0]:
                        landmarks.extend([lm.x, lm.y, lm.z])
                    secuencia.append(landmarks)
                    frames_sin_mano = 0
                    
                    h, w = frame.shape[:2]
                    for lm in result.hand_landmarks[0]:
                        x, y = int(lm.x * w), int(lm.y * h)
                        cv2.circle(frame, (x, y), 4, (0, 0, 255), -1)
                else:
                    secuencia.append([0.0] * 63)
                    frames_sin_mano += 1
                
                progreso = int((i + 1) / FRAMES_POR_SECUENCIA * 100)
                cv2.rectangle(frame, (10, 100), (10 + progreso * 4, 130), (0, 255, 0), -1)
                cv2.putText(frame, f"Grabando: {progreso}%", (10, 160),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                cv2.imshow('Captura Palabras', frame)
                cv2.waitKey(int(1000 / FPS_GRABACION))
            
            if len(secuencia) == FRAMES_POR_SECUENCIA:
                secuencia = np.array(secuencia)
                archivo = os.path.join(DATASET_PATH, palabra, f"seq_{num_secuencia}.npy")
                np.save(archivo, secuencia)
                print(f"Guardada: {archivo} | Forma: {secuencia.shape}")
            
            time.sleep(0.5)
    
    cap.release()
    cv2.destroyAllWindows()
    detector.close()
    print("\nCaptura completada")


if __name__ == "__main__":
    main()