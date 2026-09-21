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
    
    # Normalizar cada frame
    scaler = StandardScaler()
    X_flat = X.reshape(-1, FEATURES)
    X_flat = scaler.fit_transform(X_flat)
    X = X_flat.reshape(-1, FRAMES, FEATURES)
    
    # Division
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)
    
    np.save(f"{OUTPUT_PATH}/X_train.npy", X_train)
    np.save(f"{OUTPUT_PATH}/X_val.npy", X_val)
    np.save(f"{OUTPUT_PATH}/X_test.npy", X_test)
    np.save(f"{OUTPUT_PATH}/y_train.npy", y_train)
    np.save(f"{OUTPUT_PATH}/y_val.npy", y_val)
    np.save(f"{OUTPUT_PATH}/y_test.npy", y_test)
    np.save(f"{OUTPUT_PATH}/senas.npy", np.array(senas))
    joblib.dump(scaler, f"{OUTPUT_PATH}/scaler.pkl")
    
    print(f"Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")

if __name__ == "__main__":
    main()