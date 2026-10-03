import numpy as np
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "..", "dataset", "static")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "processed")


def main():
    os.makedirs(OUTPUT_PATH, exist_ok=True)
    
    X, y = [], []
    letras = sorted(os.listdir(DATASET_PATH))
    
    for idx, letra in enumerate(letras):
        letra_path = os.path.join(DATASET_PATH, letra)
        if not os.path.isdir(letra_path):
            continue
        
        for archivo in os.listdir(letra_path):
            if archivo.endswith('.npy'):
                data = np.load(os.path.join(letra_path, archivo))
                if len(data) == 63:
                    X.append(data)
                    y.append(idx)
    
    X = np.array(X)
    y = np.array(y)
    
    print(f"Total muestras: {len(X)}")
    print(f"Total clases: {len(letras)}")
    print(f"Clases: {letras}")
    
    # Division
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)
    
    # Normalizar
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val = scaler.transform(X_val)
    X_test = scaler.transform(X_test)
    
    # Guardar
    np.save(os.path.join(OUTPUT_PATH, "X_train.npy"), X_train)
    np.save(os.path.join(OUTPUT_PATH, "X_val.npy"), X_val)
    np.save(os.path.join(OUTPUT_PATH, "X_test.npy"), X_test)
    np.save(os.path.join(OUTPUT_PATH, "y_train.npy"), y_train)
    np.save(os.path.join(OUTPUT_PATH, "y_val.npy"), y_val)
    np.save(os.path.join(OUTPUT_PATH, "y_test.npy"), y_test)
    np.save(os.path.join(OUTPUT_PATH, "letras.npy"), np.array(letras))
    joblib.dump(scaler, os.path.join(OUTPUT_PATH, "scaler.pkl"))
    
    print(f"Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")


if __name__ == "__main__":
    main()