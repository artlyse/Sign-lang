from __future__ import annotations

from pathlib import Path

import torch

from feature_extractor import WORD_FEATURE_DIM, WORD_SEQUENCE_FRAMES
from train_word_model import OUTPUT_DIR, ROOT, WordLSTM


def export_last_model() -> Path:
    pt_path = ROOT / "word_model.pt"
    onnx_path = OUTPUT_DIR / "word_model.onnx"

    if not pt_path.exists():
        raise FileNotFoundError(
            f"No existe {pt_path}. Ejecuta primero el entrenamiento."
        )

    print(f"Cargando checkpoint: {pt_path}")
    checkpoint = torch.load(
        pt_path,
        map_location="cpu",
        weights_only=False,
    )

    classes = checkpoint.get("classes") or []
    if not classes:
        raise RuntimeError("El checkpoint no contiene clases")

    feature_dim = int(checkpoint.get("feature_dim", WORD_FEATURE_DIM))
    sequence_frames = int(
        checkpoint.get("sequence_frames", WORD_SEQUENCE_FRAMES)
    )

    if feature_dim != WORD_FEATURE_DIM:
        raise RuntimeError(
            f"feature_dim={feature_dim}; se esperaba {WORD_FEATURE_DIM}"
        )

    if sequence_frames != WORD_SEQUENCE_FRAMES:
        raise RuntimeError(
            f"sequence_frames={sequence_frames}; "
            f"se esperaba {WORD_SEQUENCE_FRAMES}"
        )

    model = WordLSTM(len(classes))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()

    dummy = torch.zeros(
        1,
        WORD_SEQUENCE_FRAMES,
        WORD_FEATURE_DIM,
        dtype=torch.float32,
    )

    print("Exportando ONNX con batch fijo = 1...")
    torch.onnx.export(
        model,
        dummy,
        onnx_path,
        input_names=["sequence"],
        output_names=["logits"],
        opset_version=17,
        dynamo=False,
    )

    # Validar el archivo recién exportado.
    import onnx

    model_onnx = onnx.load(str(onnx_path))
    onnx.checker.check_model(model_onnx)

    print("\nEXPORTACION CORRECTA")
    print(f"Modelo: {onnx_path}")
    print(f"Clases: {len(classes)}")
    print(
        f"Entrada esperada: "
        f"[1, {WORD_SEQUENCE_FRAMES}, {WORD_FEATURE_DIM}]"
    )
    return onnx_path


if __name__ == "__main__":
    export_last_model()
