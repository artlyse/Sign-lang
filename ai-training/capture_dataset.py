import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "hand_landmarker.task")
DATASET_PATH = os.path.join(SCRIPT_DIR, "dataset", "static")

LETRAS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
MUESTRAS_POR_LETRA = 300

# CONFIGURACION DE CAMARA
# Cambia este valor segun el indice que detectaste con listar_camaras.py
CAMERA_INDEX = 0
# Backend: cv2.CAP_DSHOW o cv2.CAP_MSMF
CAMERA_BACKEND = cv2.CAP_DSHOW
# Resolucion (None = la que la camara devuelva por defecto)
CAMERA_WIDTH = 1280
CAMERA_HEIGHT = 720


def abrir_camara():
    """Intenta abrir la camara con el backend especificado."""
    print(f"Abriendo camara indice {CAMERA_INDEX}...")
    
    cap = cv2.VideoCapture(CAMERA_INDEX, CAMERA_BACKEND)
    
    if not cap.isOpened():
        print(f"Fallo con backend {CAMERA_BACKEND}. Intentando default...")
        cap = cv2.VideoCapture(CAMERA_INDEX)
    
    if not cap.isOpened():
        print(f"No se pudo abrir la camara en indice {CAMERA_INDEX}")
        print("Prueba otro indice. Ejecuta: python ai-training\\listar_camaras.py")
        return None
    
    if CAMERA_WIDTH and CAMERA_HEIGHT:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
    
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"Camara abierta: {w}x{h}")
    
    return cap


def main():
    print(f"Buscando modelo en: {MODEL_PATH}")
    if not os.path.exists(MODEL_PATH):
        print("ERROR: No se encuentra hand_landmarker.task")
        print("Ejecuta primero: python ai-training\\descargar_modelo.py")
        return
    
    for letra in LETRAS:
        os.makedirs(os.path.join(DATASET_PATH, letra), exist_ok=True)
    
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
    
    # Ventana redimensionable
    cv2.namedWindow('Captura Dataset', cv2.WINDOW_NORMAL)
    cv2.resizeWindow('Captura Dataset', 960, 540)
    
    print("=" * 60)
    print("CAPTURA DE DATASET - SENAS ESTATICAS")
    print("=" * 60)
    print("IMPORTANTE - VARIA DURANTE LA CAPTURA:")
    print("  - Rotacion de la mano (izquierda, derecha)")
    print("  - Distancia a la camara (cerca, media, lejos)")
    print("  - Altura (arriba, centro, abajo)")
    print("  - Inclinacion (mano plana, angulada)")
    print("=" * 60)
    print(f"Se capturaran {MUESTRAS_POR_LETRA} muestras por letra")
    print("Presiona ESPACIO para empezar cada letra")
    print("Presiona Q para saltar una letra")
    print("Presiona ESC para salir")
    print("=" * 60)
    
    for letra in LETRAS:
        print(f"\nLetra: {letra}")
        print("Presiona ESPACIO cuando estes listo...")
        
        saltar = False
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error leyendo frame")
                break
            frame = cv2.flip(frame, 1)
            cv2.putText(frame, f"Preparando: {letra}", (10, 40),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
            cv2.putText(frame, "ESPACIO = iniciar | Q = saltar | ESC = salir",
                       (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            cv2.imshow('Captura Dataset', frame)
            
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
            continue
        
        contador = 0
        while contador < MUESTRAS_POR_LETRA:
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
                
                np.save(
                    os.path.join(DATASET_PATH, letra, f"{contador}.npy"),
                    np.array(landmarks)
                )
                contador += 1
                
                h, w = frame.shape[:2]
                for lm in result.hand_landmarks[0]:
                    x, y = int(lm.x * w), int(lm.y * h)
                    cv2.circle(frame, (x, y), 5, (0, 0, 255), -1)
            
            progreso = int(contador / MUESTRAS_POR_LETRA * 100)
            cv2.rectangle(frame, (10, 100), (10 + progreso * 4, 130), (0, 255, 0), -1)
            cv2.putText(frame, f"{letra}: {contador}/{MUESTRAS_POR_LETRA} ({progreso}%)",
                       (10, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.putText(frame, "Varia la posicion de tu mano!",
                       (10, 170), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)
            cv2.imshow('Captura Dataset', frame)
            
            if cv2.waitKey(1) & 0xFF == 27:
                cap.release()
                cv2.destroyAllWindows()
                detector.close()
                return
        
        print(f"Letra {letra} completada: {contador} muestras")
    
    cap.release()
    cv2.destroyAllWindows()
    detector.close()
    print("\nCaptura completada")


if __name__ == "__main__":
    main()