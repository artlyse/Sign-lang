import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import os

# Rutas absolutas
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "hand_landmarker.task")
DATASET_PATH = os.path.join(SCRIPT_DIR, "dataset", "dynamic")

# Configuracion
SENAS = ["J", "Z", "N"]          # Senas con movimiento
SECUENCIAS_POR_SENA = 50          # Cuantas veces grabar cada sena
FRAMES_POR_SECUENCIA = 30         # Duracion de cada grabacion
FPS_GRABACION = 15                # Frames por segundo a capturar

def main():
    print(f"Buscando modelo en: {MODEL_PATH}")
    if not os.path.exists(MODEL_PATH):
        print("ERROR: No se encuentra hand_landmarker.task")
        print("Ejecuta primero: python ai-training\\descargar_modelo.py")
        return
    
    # Crear carpetas
    for sena in SENAS:
        os.makedirs(os.path.join(DATASET_PATH, sena), exist_ok=True)
    
    # Configurar detector
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
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: No se pudo abrir la camara")
        return
    
    print("=" * 60)
    print("CAPTURA DE SENAS DINAMICAS (CON MOVIMIENTO)")
    print("=" * 60)
    print(f"Senas a capturar: {SENAS}")
    print(f"Secuencias por sena: {SECUENCIAS_POR_SENA}")
    print(f"Frames por secuencia: {FRAMES_POR_SECUENCIA}")
    print("=" * 60)
    print("Instrucciones:")
    print("  - Presiona ESPACIO para grabar una secuencia")
    print("  - Realiza el movimiento completo durante la grabacion")
    print("  - Presiona Q para saltar una sena")
    print("  - Presiona ESC para salir")
    print("=" * 60)
    
    for sena in SENAS:
        print(f"\n--- SENA: {sena} ---")
        print(f"Se grabaran {SECUENCIAS_POR_SENA} secuencias")
        
        for num_secuencia in range(SECUENCIAS_POR_SENA):
            print(f"\nSecuencia {num_secuencia + 1}/{SECUENCIAS_POR_SENA}")
            print("Presiona ESPACIO para empezar a grabar...")
            
            # Esperar confirmacion
            saltar_sena = False
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frame = cv2.flip(frame, 1)
                cv2.putText(frame, f"Sena: {sena} | Secuencia: {num_secuencia+1}/{SECUENCIAS_POR_SENA}",
                           (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                cv2.putText(frame, "ESPACIO = grabar | Q = saltar sena | ESC = salir",
                           (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                cv2.imshow('Captura Dinamica', frame)
                
                key = cv2.waitKey(1) & 0xFF
                if key == 32:
                    break
                elif key == ord('q'):
                    saltar_sena = True
                    break
                elif key == 27:
                    cap.release()
                    cv2.destroyAllWindows()
                    detector.close()
                    return
            
            if saltar_sena:
                break
            
            # Grabar secuencia
            print("Grabando...")
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
                    
                    # Dibujar landmarks
                    h, w = frame.shape[:2]
                    for lm in result.hand_landmarks[0]:
                        x, y = int(lm.x * w), int(lm.y * h)
                        cv2.circle(frame, (x, y), 3, (0, 0, 255), -1)
                else:
                    # Si no se detecta mano, guardar ceros
                    secuencia.append([0.0] * 63)
                    frames_sin_mano += 1
                
                # Barra de progreso
                progreso = int((i + 1) / FRAMES_POR_SECUENCIA * 100)
                cv2.rectangle(frame, (10, 100), (10 + progreso * 4, 130), (0, 255, 0), -1)
                cv2.putText(frame, f"Grabando: {progreso}%", (10, 160),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                cv2.putText(frame, f"Frame: {i+1}/{FRAMES_POR_SECUENCIA}",
                           (10, 190), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
                cv2.imshow('Captura Dinamica', frame)
                cv2.waitKey(int(1000 / FPS_GRABACION))
            
            # Guardar secuencia
            if len(secuencia) == FRAMES_POR_SECUENCIA:
                secuencia = np.array(secuencia)  # Forma: (30, 63)
                archivo = os.path.join(DATASET_PATH, sena, f"seq_{num_secuencia}.npy")
                np.save(archivo, secuencia)
                print(f"Secuencia guardada: {archivo} | Forma: {secuencia.shape}")
                
                # Verificar que se detecto mano
                if frames_sin_mano == FRAMES_POR_SECUENCIA:
                    print("ADVERTENCIA: No se detecto mano en toda la secuencia")
            else:
                print("ERROR: No se capturaron todos los frames")
            
            # Pausa entre secuencias
            import time
            time.sleep(0.5)
    
    cap.release()
    cv2.destroyAllWindows()
    detector.close()
    print("\nCaptura completada")
    print(f"Datos guardados en: {DATASET_PATH}")

if __name__ == "__main__":
    main()