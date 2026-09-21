# Captura de dataset 
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import os

# Configuracion
LETRAS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
MUESTRAS_POR_LETRA = 100
DATASET_PATH = "ai-training/dataset/static"

def main():
    # Crear carpetas
    for letra in LETRAS:
        os.makedirs(os.path.join(DATASET_PATH, letra), exist_ok=True)
    
    # Configurar detector
    base_options = python.BaseOptions(
        model_asset_path='ai-training/hand_landmarker.task'
    )
    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )
    detector = vision.HandLandmarker.create_from_options(options)
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: No se pudo abrir la camara")
        return
    
    print("=" * 60)
    print("CAPTURA DE DATASET - SENAS ESTATICAS")
    print("=" * 60)
    print("Instrucciones:")
    print("  - Presiona ESPACIO para iniciar captura de cada letra")
    print("  - Presiona Q para saltar una letra")
    print("  - Presiona ESC para salir")
    print("=" * 60)
    
    for letra in LETRAS:
        print(f"\nLetra: {letra}")
        print("Presiona ESPACIO cuando estes listo...")
        
        # Esperar confirmacion
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.flip(frame, 1)
            cv2.putText(frame, f"Preparando: {letra}", (10, 40),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
            cv2.putText(frame, "ESPACIO = iniciar | Q = saltar | ESC = salir",
                       (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            cv2.imshow('Captura Dataset', frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == 32:  # ESPACIO
                break
            elif key == ord('q'):
                letra = None
                break
            elif key == 27:  # ESC
                cap.release()
                cv2.destroyAllWindows()
                detector.close()
                return
        
        if letra is None:
            continue
        
        # Capturar muestras
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
                
                # Dibujar landmarks
                h, w = frame.shape[:2]
                for lm in result.hand_landmarks[0]:
                    x, y = int(lm.x * w), int(lm.y * h)
                    cv2.circle(frame, (x, y), 3, (0, 0, 255), -1)
            
            cv2.putText(frame, f"{letra}: {contador}/{MUESTRAS_POR_LETRA}",
                       (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
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