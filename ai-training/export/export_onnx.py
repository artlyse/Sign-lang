import torch
import torch.nn as nn
import numpy as np
import os
import shutil
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_TRAINING = os.path.dirname(SCRIPT_DIR)
MODELS = os.path.join(AI_TRAINING, "models")
PROCESSED_STATIC = os.path.join(AI_TRAINING, "processed")
PROCESSED_DYNAMIC = os.path.join(AI_TRAINING, "processed_dynamic")
BACKEND_MODELS = os.path.join(AI_TRAINING, "..", "backend", "app", "ai", "models")

# Carpeta temporal corta (evita problemas con OneDrive y limite de 260 caracteres)
TEMP_DIR = "C:\\temp\\signlang_onnx"


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


def consolidar_onnx(temp_path, final_path):
    """Carga el ONNX (con o sin external data) y lo guarda todo en un solo archivo."""
    import onnx
    
    model = onnx.load(temp_path)  # Carga automaticamente external data
    os.makedirs(os.path.dirname(final_path), exist_ok=True)
    onnx.save(model, final_path, save_as_external_data=False)
    
    # Limpiar archivos temporales
    for f in os.listdir(os.path.dirname(temp_path)):
        if f.startswith(os.path.basename(temp_path)):
            try:
                os.remove(os.path.join(os.path.dirname(temp_path), f))
            except:
                pass


def exportar_mlp():
    print("\nExportando MLP estatico...")
    
    letras = np.load(os.path.join(PROCESSED_STATIC, "letras.npy"))
    mlp = GestureClassifier(63, len(letras))
    mlp.load_state_dict(torch.load(
        os.path.join(MODELS, "gesture_model.pt"), map_location='cpu'))
    mlp.eval()
    
    dummy = torch.randn(1, 63)
    
    # Guardar primero en carpeta temporal
    temp_path = os.path.join(TEMP_DIR, "gesture_model.onnx")
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    torch.onnx.export(
        mlp,
        dummy,
        temp_path,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
        opset_version=18,
        do_constant_folding=True,
    )
    
    # Consolidar en un solo archivo y copiar al backend
    final_path = os.path.join(BACKEND_MODELS, "gesture_model.onnx")
    consolidar_onnx(temp_path, final_path)
    
    size_kb = os.path.getsize(final_path) / 1024
    print(f"  Guardado: {final_path}")
    print(f"  Tamanio: {size_kb:.2f} KB")


def exportar_lstm():
    print("\nExportando LSTM dinamico...")
    
    senas = np.load(os.path.join(PROCESSED_DYNAMIC, "senas.npy"))
    lstm = SignLSTM(63, 128, 2, len(senas))
    lstm.load_state_dict(torch.load(
        os.path.join(MODELS, "lstm_model.pt"), map_location='cpu'))
    lstm.eval()
    
    dummy = torch.randn(1, 30, 63)
    temp_path = os.path.join(TEMP_DIR, "lstm_model.onnx")
    
    torch.onnx.export(
        lstm,
        dummy,
        temp_path,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
        opset_version=18,
        do_constant_folding=True,
    )
    
    final_path = os.path.join(BACKEND_MODELS, "lstm_model.onnx")
    consolidar_onnx(temp_path, final_path)
    
    size_kb = os.path.getsize(final_path) / 1024
    print(f"  Guardado: {final_path}")
    print(f"  Tamanio: {size_kb:.2f} KB")


def copiar_extras():
    print("\nCopiando scalers y modelo MediaPipe...")
    
    os.makedirs(BACKEND_MODELS, exist_ok=True)
    
    shutil.copy(
        os.path.join(PROCESSED_STATIC, "scaler.pkl"),
        os.path.join(BACKEND_MODELS, "scaler_static.pkl")
    )
    print("  scaler_static.pkl copiado")
    
    shutil.copy(
        os.path.join(PROCESSED_DYNAMIC, "scaler.pkl"),
        os.path.join(BACKEND_MODELS, "scaler_dynamic.pkl")
    )
    print("  scaler_dynamic.pkl copiado")
    
    hand_model = os.path.join(AI_TRAINING, "hand_landmarker.task")
    if os.path.exists(hand_model):
        shutil.copy(hand_model, os.path.join(BACKEND_MODELS, "hand_landmarker.task"))
        print("  hand_landmarker.task copiado")


def verificar_onnx():
    print("\nVerificando modelos ONNX...")
    import onnxruntime as ort
    
    for nombre in ["gesture_model.onnx", "lstm_model.onnx"]:
        path = os.path.join(BACKEND_MODELS, nombre)
        if os.path.exists(path):
            try:
                session = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
                input_shape = session.get_inputs()[0].shape
                output_shape = session.get_outputs()[0].shape
                print(f"  {nombre}: OK")
                print(f"    Input: {input_shape}")
                print(f"    Output: {output_shape}")
            except Exception as e:
                print(f"  {nombre}: ERROR - {e}")


def main():
    print("=" * 60)
    print("EXPORTACION DE MODELOS A ONNX")
    print("=" * 60)
    print(f"Carpeta temporal: {TEMP_DIR}")
    
    # Limpiar temp anterior
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR, ignore_errors=True)
    os.makedirs(TEMP_DIR, exist_ok=True)
    os.makedirs(BACKEND_MODELS, exist_ok=True)
    
    try:
        exportar_mlp()
        exportar_lstm()
        copiar_extras()
        verificar_onnx()
        
        print("\n" + "=" * 60)
        print("EXPORTACION COMPLETADA")
        print("=" * 60)
    
    finally:
        # Limpiar carpeta temporal
        if os.path.exists(TEMP_DIR):
            shutil.rmtree(TEMP_DIR, ignore_errors=True)


if __name__ == "__main__":
    main()