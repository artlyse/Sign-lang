"""Entrena y exporta el LSTM del modo Palabra.

Carga NPZ de 30x192, divide train/validación, normaliza, entrena con PyTorch y
exporta word_model.onnx, scaler_word.pkl y word_labels.json para el backend."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import joblib
import numpy as np
import torch
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from dataset_utils import DATASET_DIR
from feature_extractor import WORD_FEATURE_DIM, WORD_SEQUENCE_FRAMES

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parents[1]
OUTPUT_DIR = PROJECT_ROOT / "backend" / "app" / "ai" / "models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class WordLSTM(nn.Module):
    def __init__(self, num_classes: int, hidden_size: int = 128):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=WORD_FEATURE_DIM,
            hidden_size=hidden_size,
            num_layers=2,
            dropout=0.20,
            batch_first=True,
        )
        self.head = nn.Sequential(
            nn.LayerNorm(hidden_size),
            nn.Dropout(0.20),
            nn.Linear(hidden_size, num_classes),
        )

    def forward(self, x):
        output, _ = self.lstm(x)
        return self.head(output[:, -1, :])


def load_dataset():
    X = []
    labels = []

    for path in sorted(DATASET_DIR.glob("*/*.npz")):
        payload = np.load(path, allow_pickle=False)
        sequence = np.asarray(payload["sequence"], dtype=np.float32)
        if sequence.shape != (WORD_SEQUENCE_FRAMES, WORD_FEATURE_DIM):
            print(f"IGNORADO {path.name}: forma {sequence.shape}")
            continue
        label = str(payload["label"].item()).strip().upper()
        if not label:
            continue
        X.append(sequence)
        labels.append(label)

    if not X:
        raise RuntimeError("No hay muestras en ai-training/word_mode/dataset")

    classes = sorted(set(labels))
    if len(classes) < 2:
        raise RuntimeError("Entrena al menos 2 palabras distintas")

    counts = {label: labels.count(label) for label in classes}
    too_small = {label: count for label, count in counts.items() if count < 4}
    if too_small:
        raise RuntimeError(
            "Cada palabra necesita al menos 4 muestras. Faltan: "
            + ", ".join(f"{k}={v}" for k, v in too_small.items())
        )

    mapping = {label: index for index, label in enumerate(classes)}
    y = np.asarray([mapping[label] for label in labels], dtype=np.int64)
    return np.asarray(X, dtype=np.float32), y, classes, counts


def train(epochs: int = 55, batch_size: int = 16, seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

    X, y, classes, counts = load_dataset()
    print("Clases:", counts)

    test_size = max(len(classes), round(len(X) * 0.20))
    test_size = min(test_size, len(X) - len(classes))
    if test_size < len(classes):
        test_size = len(classes)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=seed,
        stratify=y,
    )

    scaler = StandardScaler()
    scaler.fit(X_train.reshape(-1, WORD_FEATURE_DIM))

    def scale(data):
        flat = scaler.transform(data.reshape(-1, WORD_FEATURE_DIM)).astype(np.float32)
        return flat.reshape(-1, WORD_SEQUENCE_FRAMES, WORD_FEATURE_DIM)

    X_train = scale(X_train)
    X_test = scale(X_test)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Entrenamiento en: {device}")
    if device.type == "cuda":
        print("GPU:", torch.cuda.get_device_name(0))

    model = WordLSTM(len(classes)).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1.5e-3, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.03)

    train_loader = DataLoader(
        TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train)),
        batch_size=min(batch_size, len(X_train)),
        shuffle=True,
    )

    best_accuracy = -1.0
    best_state = None

    for epoch in range(1, epochs + 1):
        model.train()
        losses = []
        for batch_x, batch_y in train_loader:
            batch_x = batch_x.to(device)
            batch_y = batch_y.to(device)

            optimizer.zero_grad(set_to_none=True)
            logits = model(batch_x)
            loss = criterion(logits, batch_y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            optimizer.step()
            losses.append(float(loss.item()))

        model.eval()
        with torch.inference_mode():
            test_logits = model(torch.from_numpy(X_test).to(device))
            predictions = test_logits.argmax(dim=1).cpu().numpy()
            accuracy = float((predictions == y_test).mean())

        if accuracy > best_accuracy:
            best_accuracy = accuracy
            best_state = {
                key: value.detach().cpu().clone()
                for key, value in model.state_dict().items()
            }

        if epoch == 1 or epoch % 5 == 0 or epoch == epochs:
            avg_loss = sum(losses) / max(len(losses), 1)
            print(
                f"Epoch {epoch:03d}/{epochs} | loss={avg_loss:.4f} | "
                f"val_acc={accuracy * 100:.1f}%"
            )

    if best_state is not None:
        model.load_state_dict(best_state)
    model = model.cpu().eval()

    with torch.inference_mode():
        logits = model(torch.from_numpy(X_test))
        predictions = logits.argmax(dim=1).numpy()

    print("\nRESULTADOS")
    print(f"Mejor accuracy validacion: {best_accuracy * 100:.2f}%")
    print(
        classification_report(
            y_test,
            predictions,
            labels=list(range(len(classes))),
            target_names=classes,
            zero_division=0,
        )
    )

    scaler_path = OUTPUT_DIR / "scaler_word.pkl"
    labels_path = OUTPUT_DIR / "word_labels.json"
    onnx_path = OUTPUT_DIR / "word_model.onnx"
    pt_path = ROOT / "word_model.pt"

    joblib.dump(scaler, scaler_path)
    labels_path.write_text(
        json.dumps(classes, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    torch.save(
        {
            "state_dict": model.state_dict(),
            "classes": classes,
            "feature_dim": WORD_FEATURE_DIM,
            "sequence_frames": WORD_SEQUENCE_FRAMES,
        },
        pt_path,
    )

    dummy = torch.zeros(
        1,
        WORD_SEQUENCE_FRAMES,
        WORD_FEATURE_DIM,
        dtype=torch.float32,
    )
    try:
        import onnx  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "Falta el paquete 'onnx'. Instala con: "
            "python -m pip install onnx. "
            "El checkpoint word_model.pt ya fue guardado, por lo que "
            "despues puedes ejecutar exportar_onnx.bat sin reentrenar."
        ) from exc

    # El backend siempre infiere una sola secuencia:
    # [1, WORD_SEQUENCE_FRAMES, WORD_FEATURE_DIM].
    # Se exporta batch fijo 1 para evitar problemas del LSTM con batch dinámico.
    torch.onnx.export(
        model,
        dummy,
        onnx_path,
        input_names=["sequence"],
        output_names=["logits"],
        opset_version=17,
        dynamo=False,
    )

    import onnx
    onnx.checker.check_model(onnx.load(str(onnx_path)))

    print("\nEXPORTADO")
    print(onnx_path)
    print(scaler_path)
    print(labels_path)
    print("\nReinicia FastAPI para que el backend cargue el nuevo modelo.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=55)
    parser.add_argument("--batch", type=int, default=16)
    args = parser.parse_args()
    train(args.epochs, args.batch)
