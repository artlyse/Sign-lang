import numpy as np
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_STATIC = os.path.join(SCRIPT_DIR, "dataset", "static")
DATASET_DYNAMIC = os.path.join(SCRIPT_DIR, "dataset", "dynamic")


def normalizar_landmark(landmarks):
    pts = np.array(landmarks, dtype=np.float32).reshape(21, 3)
    pts = pts - pts[0]
    max_dist = np.max(np.linalg.norm(pts, axis=1))
    if max_dist > 0:
        pts = pts / max_dist
    return pts.flatten()


def normalizar_estaticas():
    print("Normalizando estaticas...")
    for letra in sorted(os.listdir(DATASET_STATIC)):
        letra_path = os.path.join(DATASET_STATIC, letra)
        if not os.path.isdir(letra_path):
            continue
        
        count = 0
        for archivo in os.listdir(letra_path):
            if not archivo.endswith('.npy'):
                continue
            
            ruta = os.path.join(letra_path, archivo)
            data = np.load(ruta)
            
            if len(data) == 63:
                normalizada = normalizar_landmark(data)
                np.save(ruta, normalizada)
                count += 1
        
        print(f"  {letra}: {count} muestras normalizadas")


def normalizar_dinamicas():
    print("\nNormalizando dinamicas...")
    for sena in sorted(os.listdir(DATASET_DYNAMIC)):
        sena_path = os.path.join(DATASET_DYNAMIC, sena)
        if not os.path.isdir(sena_path):
            continue
        
        count = 0
        for archivo in os.listdir(sena_path):
            if not archivo.endswith('.npy'):
                continue
            
            ruta = os.path.join(sena_path, archivo)
            data = np.load(ruta)
            
            if data.shape[1] == 63:
                normalizada = np.array([normalizar_landmark(f) for f in data])
                np.save(ruta, normalizada)
                count += 1
        
        print(f"  {sena}: {count} secuencias normalizadas")


if __name__ == "__main__":
    normalizar_estaticas()
    normalizar_dinamicas()
    print("\nDataset normalizado correctamente")