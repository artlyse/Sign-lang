"""
Verifica los datasets activos de SignLang.

Activos:
- ai-training/dataset/static       -> MLP de letras estáticas.
- ai-training/dataset/dynamic      -> LSTM de letras dinámicas.
- ai-training/word_mode/dataset    -> LSTM de palabras (2 manos + pose).

Los prototipos antiguos `words` y `two_hands` fueron retirados porque el
pipeline `word_mode` los reemplaza.
"""

from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent
DATASET_ROOT = ROOT / "dataset"
WORD_DATASET_ROOT = ROOT / "word_mode" / "dataset"


def _verify_npy_dataset(name: str, path: Path, expected_shape, minimum: int):
    print("\n" + "=" * 60)
    print(f"TIPO: {name.upper()}")
    print(f"Ruta: {path}")
    print("=" * 60)

    if not path.exists():
        print("  CARPETA NO EXISTE")
        return 0, 0

    folders = sorted(item for item in path.iterdir() if item.is_dir())
    if not folders:
        print("  CARPETA VACIA")
        return 0, 0

    total = 0
    valid_classes = 0
    for folder in folders:
        files = sorted(folder.glob("*.npy"))
        total += len(files)
        shape_info = ""
        if files:
            try:
                data = np.load(files[0])
                shape_info = f" | Forma: {data.shape}"
                if expected_shape and data.shape != expected_shape:
                    shape_info += f" (ESPERADO: {expected_shape})"
            except Exception as exc:
                shape_info = f" | ERROR: {exc}"

        ok = len(files) >= minimum
        valid_classes += int(ok)
        state = "[OK]" if ok else f"[POCAS - minimo {minimum}]"
        print(f"  {folder.name}: {len(files)} muestras {state}{shape_info}")

    return total, valid_classes


def _verify_word_mode():
    print("\n" + "=" * 60)
    print("TIPO: WORD_MODE (2 MANOS + POSE)")
    print(f"Ruta: {WORD_DATASET_ROOT}")
    print("=" * 60)

    if not WORD_DATASET_ROOT.exists():
        print("  CARPETA NO EXISTE")
        return 0, 0

    folders = sorted(item for item in WORD_DATASET_ROOT.iterdir() if item.is_dir())
    total = 0
    valid_classes = 0

    for folder in folders:
        files = sorted(folder.glob("*.npz"))
        total += len(files)
        shape_info = ""
        if files:
            try:
                payload = np.load(files[0])
                sequence = payload["sequence"]
                shape_info = f" | Forma: {sequence.shape}"
                if sequence.shape != (30, 192):
                    shape_info += " (ESPERADO: (30, 192))"
            except Exception as exc:
                shape_info = f" | ERROR: {exc}"

        ok = len(files) >= 20
        valid_classes += int(ok)
        state = "[OK]" if ok else "[POCAS - minimo 20]"
        print(f"  {folder.name}: {len(files)} muestras {state}{shape_info}")

    return total, valid_classes


def main():
    print("=" * 60)
    print("SIGNLANG - VERIFICACION DE DATASETS ACTIVOS")
    print("=" * 60)

    summary = {}
    summary["static"] = _verify_npy_dataset(
        "static",
        DATASET_ROOT / "static",
        (63,),
        100,
    )
    summary["dynamic"] = _verify_npy_dataset(
        "dynamic",
        DATASET_ROOT / "dynamic",
        (30, 63),
        30,
    )
    summary["word_mode"] = _verify_word_mode()

    print("\n" + "=" * 60)
    print("RESUMEN")
    print("=" * 60)
    for name, (samples, classes) in summary.items():
        print(f"  {name:15s}: {samples:6d} muestras | {classes:3d} clases OK")


if __name__ == "__main__":
    main()
