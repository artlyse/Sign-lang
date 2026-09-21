import torch
import torch.nn as nn
import numpy as np
import os
import shutil
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_TRAINING = os.path.dirname(SCRIPT_DIR)              # ai-training/
MODELS = os.path.join(AI_TRAINING, "models")
PROCESSED_STATIC = os.path.join(AI_TRAINING, "processed")
PROCESSED_DYNAMIC = os.path.join(AI_TRAINING, "processed_dynamic")
BACKEND_MODELS = os.path.join(AI_TRAINING, "..", "backend", "app", "ai", "models")

def verificar_archivos():
    """Verifica que existan todos los archivos necesarios."""
    errores = []
    
    archivos_static = [
        os.path.join(PROCESSED_STATIC, "letras.npy"),
        os.path.join(PROCESSED_STATIC, "scaler.pkl"),
        os.path.join(MODELS, "gesture_model.pt"),
    ]
    
    archivos_dynamic = [
        os.path.join(PROCESSED_DYNAMIC, "senas.npy"),
        os.path.join(PROCESSED_DYNAMIC, "scaler.pkl"),
        os.path.join(MODELS, "lstm_model.pt"),
    ]
    
    for f in archivos_static + archivos_dynamic:
        if not os.path.exists(f):
            errores.append(f)
    
    if errores:
        print("ERROR: Faltan los siguientes archivos:")
        for e in errores:
            print(f"  - {e}")
        print("\nEjecuta primero:")
        print("  python ai-training\\training\\preprocess.py")
        print("  python ai-training\\training\\preprocess_dynamic.py")
        print("  python ai-training\\training\\train_mlp.py")
        print("  python ai-training\\training\\train_lstm.py")
        return False
    
    return True


class GestureClassifier(nn.Module):
    def __init__(self, input_size=63, num_classes=26):
        super().__init__()
        self.fc1 = nn.Linear(input_size, 128)
        self.bn1 = nn.BatchNorm1d(128)
        self.fc2 = nn.Linear(128, 64)
        self.bn2 = nn.BatchNorm1d(64)
        self.fc3 = nn.Linear(64, num_classes)
        self.dropout = nn.Dropout(0.3)
        self.relu = nn.ReLU()
    
    def forward(self, x):
        x = self.relu(self.bn1(self.fc1(x)))
        x = self.dropout(x)
        x = self.relu(self.bn2(self.fc2(x)))
        x = self.dropout(x)
        return self.fc3(x)


class SignLSTM(nn.Module):
    def __init__(self, input_size=63, hidden_size=128, num_layers=2, num_classes=3):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                            batch_first=True, dropout=0.3)
        self.fc = nn.Linear(hidden_size, num_classes)
    
    def forward(self, x):
        out, _ = self.lstm(x)
        out = out[:, -1, :]
        return self.fc(out)


def main():
    print("=" * 60)
    print("EXPORTACION DE MODELOS A ONNX")
    print("=" * 60)
    
    if not verificar_archivos():
        return
    
    os.makedirs(BACKEND_MODELS, exist_ok=True)
    
    # --- Exportar MLP estatico ---
    print("\nExportando MLP estatico...")
    letras = np.load(os.path.join(PROCESSED_STATIC, "letras.npy"))
    mlp = GestureClassifier(63, len(letras))
    mlp.load_state_dict(torch.load(
        os.path.join(MODELS, "gesture_model.pt"), map_location='cpu'))
    mlp.eval()
    
    torch.onnx.export(
        mlp, torch.randn(1, 63),
        os.path.join(BACKEND_MODELS, "gesture_model.onnx"),
        input_names=['input'], output_names=['output'],
        dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
        opset_version=14
    )
    print(f"  Guardado en: {BACKEND_MODELS}/gesture_model.onnx")
    
    # --- Exportar LSTM dinamico ---
    print("\nExportando LSTM dinamico...")
    senas = np.load(os.path.join(PROCESSED_DYNAMIC, "senas.npy"))
    lstm = SignLSTM(63, 128, 2, len(senas))
    lstm.load_state_dict(torch.load(
        os.path.join(MODELS, "lstm_model.pt"), map_location='cpu'))
    lstm.eval()
    
    torch.onnx.export(
        lstm, torch.randn(1, 30, 63),
        os.path.join(BACKEND_MODELS, "lstm_model.onnx"),
        input_names=['input'], output_names=['output'],
        dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
        opset_version=14
    )
    print(f"  Guardado en: {BACKEND_MODELS}/lstm_model.onnx")
    
    # --- Copiar scalers y modelo MediaPipe ---
    print("\nCopiando scalers y modelo MediaPipe...")
    shutil.copy(
        os.path.join(PROCESSED_STATIC, "scaler.pkl"),
        os.path.join(BACKEND_MODELS, "scaler_static.pkl")
    )
    shutil.copy(
        os.path.join(PROCESSED_DYNAMIC, "scaler.pkl"),
        os.path.join(BACKEND_MODELS, "scaler_dynamic.pkl")
    )
    
    hand_model = os.path.join(AI_TRAINING, "hand_landmarker.task")
    if os.path.exists(hand_model):
        shutil.copy(hand_model, os.path.join(BACKEND_MODELS, "hand_landmarker.task"))
        print("  hand_landmarker.task copiado")
    
    print("\n" + "=" * 60)
    print("EXPORTACION COMPLETADA")
    print("=" * 60)
    print(f"Modelos en: {BACKEND_MODELS}")


if __name__ == "__main__":
    main()