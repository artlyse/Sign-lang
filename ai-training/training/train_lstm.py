# Entrenamiento LSTM 
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROCESSED = os.path.join(SCRIPT_DIR, "..", "processed_dynamic")
MODELS = os.path.join(SCRIPT_DIR, "..", "models")
os.makedirs(MODELS, exist_ok=True)

FRAMES = 30
FEATURES = 63

class SignLSTM(nn.Module):
    def __init__(self, input_size=63, hidden_size=128, num_layers=2, num_classes=3):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, 
                            batch_first=True, dropout=0.3)
        self.fc = nn.Linear(hidden_size, num_classes)
    
    def forward(self, x):
        out, _ = self.lstm(x)
        out = out[:, -1, :]  # Ultimo frame
        return self.fc(out)

def main():
    X_train = torch.tensor(np.load(f"{PROCESSED}/X_train.npy"), dtype=torch.float32)
    X_val = torch.tensor(np.load(f"{PROCESSED}/X_val.npy"), dtype=torch.float32)
    y_train = torch.tensor(np.load(f"{PROCESSED}/y_train.npy"), dtype=torch.long)
    y_val = torch.tensor(np.load(f"{PROCESSED}/y_val.npy"), dtype=torch.long)
    
    senas = np.load(f"{PROCESSED}/senas.npy")
    num_classes = len(senas)
    
    train_loader = DataLoader(TensorDataset(X_train, y_train), batch_size=16, shuffle=True)
    val_loader = DataLoader(TensorDataset(X_val, y_val), batch_size=16)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Dispositivo: {device}")
    print(f"Clases: {senas}")
    
    model = SignLSTM(FEATURES, 128, 2, num_classes).to(device)
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
            torch.save(model.state_dict(), f"{MODELS}/lstm_model.pt")
        
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}: Val Acc = {acc:.2f}%")
    
    print(f"\nMejor precision: {best_acc:.2f}%")
    print(f"Modelo guardado en: {MODELS}/lstm_model.pt")

if __name__ == "__main__":
    main()