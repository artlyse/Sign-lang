import numpy as np
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "..", "dataset", "dynamic")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "processed_dynamic")

FRAMES = 30
FEATURES = 63


def main():
    os.makedirs(OUTPUT_PATH, exist_ok=True)
    
    X, y = [], []
    senas = sorted(os.listdir(DATASET_PATH))
    
    for idx, sena in enumerate(senas):
        sena_path = os.path.join(DATASET_PATH, sena)
        if not os.path.isdir(sena_path):
            continue
        
        for archivo in os.listdir(sena_path):
            if archivo.endswith('.npy'):
                data = np.load(os.path.join(sena_path, archivo))
                if data.shape == (FRAMES, FEATURES):
                    X.append(data)
                    y.append(idx)
    
    X = np.array(X)  # Forma: (N, 30, 63)
    y = np.array(y)
    
    print(f"Total secuencias: {len(X)}")
    print(f"Total clases: {len(senas)}")
    print(f"Forma de X: {X.shape}")
    print(f"Clases: {senas}")
    
    # 1. PRIMERO dividir
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)
    
    # 2. DESPUES normalizar (scaler solo ve train)
    scaler = StandardScaler()
    
    # Aplanar para el scaler
    X_train_flat = X_train.reshape(-1, FEATURES)
    X_val_flat = X_val.reshape(-1, FEATURES)
    X_test_flat = X_test.reshape(-1, FEATURES)
    
    X_train_flat = scaler.fit_transform(X_train_flat)
    X_val_flat = scaler.transform(X_val_flat)
    X_test_flat = scaler.transform(X_test_flat)
    
    # Volver a dar forma de secuencia
    X_train = X_train_flat.reshape(-1, FRAMES, FEATURES)
    X_val = X_val_flat.reshape(-1, FRAMES, FEATURES)
    X_test = X_test_flat.reshape(-1, FRAMES, FEATURES)
    
    # Guardar
    np.save(os.path.join(OUTPUT_PATH, "X_train.npy"), X_train)
    np.save(os.path.join(OUTPUT_PATH, "X_val.npy"), X_val)
    np.save(os.path.join(OUTPUT_PATH, "X_test.npy"), X_test)
    np.save(os.path.join(OUTPUT_PATH, "y_train.npy"), y_train)
    np.save(os.path.join(OUTPUT_PATH, "y_val.npy"), y_val)
    np.save(os.path.join(OUTPUT_PATH, "y_test.npy"), y_test)
    np.save(os.path.join(OUTPUT_PATH, "senas.npy"), np.array(senas))
    joblib.dump(scaler, os.path.join(OUTPUT_PATH, "scaler.pkl"))
    
    print(f"Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")


if __name__ == "__main__":
    main()