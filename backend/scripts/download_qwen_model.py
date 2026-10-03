from pathlib import Path

from huggingface_hub import snapshot_download

from app.config import SENTENCE_AI_LOCAL_DIR, SENTENCE_AI_MODEL_ID


def main():
    target = Path(SENTENCE_AI_LOCAL_DIR).resolve()
    target.mkdir(parents=True, exist_ok=True)

    print(f"Repositorio: {SENTENCE_AI_MODEL_ID}")
    print(f"Destino: {target}")

    snapshot_download(
        repo_id=SENTENCE_AI_MODEL_ID,
        local_dir=str(target),
        allow_patterns=[
            "config.json",
            "generation_config.json",
            "tokenizer_config.json",
            "tokenizer.json",
            "vocab.json",
            "merges.txt",
            "model.safetensors",
        ],
    )

    print("\nArchivos:")
    for name in (
        "config.json",
        "tokenizer_config.json",
        "tokenizer.json",
        "model.safetensors",
    ):
        p = target / name
        if p.exists():
            print(f"OK  {name}: {p.stat().st_size / 1024 / 1024:.1f} MB")
        else:
            print(f"FALTA  {name}")

    print("\nDescarga terminada.")


if __name__ == "__main__":
    main()
