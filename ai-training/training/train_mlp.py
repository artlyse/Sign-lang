import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROCESSED = os.path.join(SCRIPT_DIR, "..", "processed")
MODELS = os.path.join(SCRIPT_DIR, "..", "models")
os.makedirs(MODELS, exist_ok=True)


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


def main():
    print("=" * 60)
    print("ENTRENAMIENTO MODELO MLP - SENAS ESTATICAS")
    print("=" * 60)
    
    # Verificar archivos
    x_train_path = os.path.join(PROCESSED, "X_train.npy")
    if not os.path.exists(x_train_path):
        print(f"ERROR: No se encuentra {x_train_path}")
        print("Ejecuta primero: python ai-training\\training\\preprocess.py")
        return
    
    # Cargar datos
    X_train = torch.tensor(np.load(os.path.join(PROCESSED, "X_train.npy")), dtype=torch.float32)
    X_val = torch.tensor(np.load(os.path.join(PROCESSED, "X_val.npy")), dtype=torch.float32)
    y_train = torch.tensor(np.load(os.path.join(PROCESSED, "y_train.npy")), dtype=torch.long)
    y_val = torch.tensor(np.load(os.path.join(PROCESSED, "y_val.npy")), dtype=torch.long)
    
    letras = np.load(os.path.join(PROCESSED, "letras.npy"))
    
    print(f"Entrenamiento: {X_train.shape[0]} muestras")
    print(f"Validacion: {X_val.shape[0]} muestras")
    print(f"Clases: {len(letras)}")
    
    train_loader = DataLoader(TensorDataset(X_train, y_train), batch_size=32, shuffle=True)
    val_loader = DataLoader(TensorDataset(X_val, y_val), batch_size=32)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Dispositivo: {device}")
    
    model = GestureClassifier(input_size=63, num_classes=len(letras)).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    best_acc = 0
    for epoch in range(100):
        model.train()
        for xb, yb in train_loader:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimizer.step()
        
        model.eval()
        correct, total = 0, 0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(device), yb.to(device)
                _, pred = torch.max(model(xb), 1)
                total += yb.size(0)
                correct += (pred == yb).sum().item()
        
        acc = 100 * correct / total
        if acc > best_acc:
            best_acc = acc
            torch.save(model.state_dict(), os.path.join(MODELS, "gesture_model.pt"))
        
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}: Val Acc = {acc:.2f}%")
    
    print("=" * 60)
    print(f"Mejor precision: {best_acc:.2f}%")
    print(f"Modelo guardado en: {os.path.join(MODELS, 'gesture_model.pt')}")
    print("=" * 60)


if __name__ == "__main__":
    main()