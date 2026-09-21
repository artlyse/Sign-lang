# Entrenamiento MLP 
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import joblib
import os

PROCESSED = "ai-training/processed"
MODELS = "ai-training/models"
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
    # Cargar datos
    X_train = torch.tensor(np.load(f"{PROCESSED}/X_train.npy"), dtype=torch.float32)
    X_val = torch.tensor(np.load(f"{PROCESSED}/X_val.npy"), dtype=torch.float32)
    y_train = torch.tensor(np.load(f"{PROCESSED}/y_train.npy"), dtype=torch.long)
    y_val = torch.tensor(np.load(f"{PROCESSED}/y_val.npy"), dtype=torch.long)
    
    letras = np.load(f"{PROCESSED}/letras.npy")
    
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
        
        # Validacion
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
            torch.save(model.state_dict(), f"{MODELS}/gesture_model.pt")
        
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}: Val Acc = {acc:.2f}%")
    
    print(f"\nMejor precision: {best_acc:.2f}%")
    print(f"Modelo guardado en: {MODELS}/gesture_model.pt")

if __name__ == "__main__":
    main()