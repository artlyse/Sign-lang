import numpy as np
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "..", "dataset", "static")


def rotar_landmarks(landmarks, angulo_grados):
    """Rota los landmarks en el plano XY."""
    angulo = np.radians(angulo_grados)
    cos_a, sin_a = np.cos(angulo), np.sin(angulo)
    pts = landmarks.reshape(21, 3).copy()
    
    x_new = pts[:, 0] * cos_a - pts[:, 1] * sin_a
    y_new = pts[:, 0] * sin_a + pts[:, 1] * cos_a
    pts[:, 0] = x_new
    pts[:, 1] = y_new
    
    return pts.flatten()


def escalar_landmarks(landmarks, factor):
    """Escala los landmarks."""
    pts = landmarks.reshape(21, 3).copy()
    pts[:, :2] *= factor
    return pts.flatten()


def trasladar_landmarks(landmarks, dx, dy):
    """Traslada los landmarks."""
    pts = landmarks.reshape(21, 3).copy()
    pts[:, 0] += dx
    pts[:, 1] += dy
    return pts.flatten()


def main():
    total_augmentado = 0
    
    for letra in sorted(os.listdir(DATASET_PATH)):
        letra_path = os.path.join(DATASET_PATH, letra)
        if not os.path.isdir(letra_path):
            continue
        
        archivos = [f for f in os.listdir(letra_path)
                    if f.endswith('.npy') and not f.startswith('aug_')]
        
        if len(archivos) == 0:
            continue
        
        print(f"Augmentando {letra} ({len(archivos)} originales)...")
        
        contador = 0
        # Augmentar solo una fraccion para no explotar el dataset
        archivos_a_augmentar = archivos[:min(100, len(archivos))]
        
        for archivo in archivos_a_augmentar:
            data = np.load(os.path.join(letra_path, archivo))
            
            # Rotaciones
            for angulo in [-25, -15, -8, 8, 15, 25]:
                nueva = rotar_landmarks(data, angulo)
                np.save(
                    os.path.join(letra_path, f"aug_r{angulo}_{contador}.npy"),
                    nueva
                )
                contador += 1
            
            # Escalados
            for factor in [0.8, 0.9, 1.1, 1.2]:
                nueva = escalar_landmarks(data, factor)
                np.save(
                    os.path.join(letra_path, f"aug_s{factor}_{contador}.npy"),
                    nueva
                )
                contador += 1
            
            # Traslaciones
            for dx, dy in [(-0.05, 0), (0.05, 0), (0, -0.05), (0, 0.05)]:
                nueva = trasladar_landmarks(data, dx, dy)
                np.save(
                    os.path.join(letra_path, f"aug_t{contador}.npy"),
                    nueva
                )
                contador += 1
        
        total_augmentado += contador
        print(f"  Aumentado a {len(archivos) + contador} muestras")
    
    print(f"\nTotal de muestras augmentadas: {total_augmentado}")


if __name__ == "__main__":
    main()