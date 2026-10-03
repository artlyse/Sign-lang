from __future__ import annotations

import re
import threading
from pathlib import Path
from typing import Any, Optional

from app.config import (
    SENTENCE_AI_ENABLED,
    SENTENCE_AI_LOCAL_DIR,
    SENTENCE_AI_MAX_INPUT_CHARS,
    SENTENCE_AI_MAX_NEW_TOKENS,
    SENTENCE_AI_MIN_WORDS,
    SENTENCE_AI_MODEL_ID,
    SENTENCE_AI_USE_GPU,
)


class SentenceCorrectorService:
    """
    Corrector contextual local.

    Flujo:
      1) Verifica que el snapshot local exista y este completo.
      2) Si falta, lo descarga explicitamente con huggingface_hub.
      3) Carga SIEMPRE desde la carpeta local usando safetensors.
      4) El modelo se reutiliza mientras el backend siga encendido.
    """

    REQUIRED_FILES = (
        "config.json",
        "tokenizer_config.json",
        "tokenizer.json",
        "model.safetensors",
    )

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._loaded = False
        self._load_error: Optional[str] = None

        self._torch: Any = None
        self._tokenizer: Any = None
        self._model: Any = None
        self._device = "cpu"

    @property
    def loaded(self) -> bool:
        return self._loaded

    @property
    def device(self) -> str:
        return self._device

    def _model_dir(self) -> Path:
        return Path(SENTENCE_AI_LOCAL_DIR).resolve()

    def _snapshot_is_complete(self, model_dir: Path) -> bool:
        return all((model_dir / name).is_file() for name in self.REQUIRED_FILES)

    def _ensure_snapshot(self) -> Path:
        model_dir = self._model_dir()
        model_dir.mkdir(parents=True, exist_ok=True)

        if self._snapshot_is_complete(model_dir):
            return model_dir

        print(
            f"Modelo contextual no esta completo en {model_dir}. "
            f"Descargando {SENTENCE_AI_MODEL_ID}..."
        )

        try:
            from huggingface_hub import snapshot_download

            snapshot_download(
                repo_id=SENTENCE_AI_MODEL_ID,
                local_dir=str(model_dir),
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
        except Exception as exc:
            raise RuntimeError(
                "No se pudo descargar Qwen desde Hugging Face. "
                f"{type(exc).__name__}: {exc}"
            ) from exc

        missing = [
            name for name in self.REQUIRED_FILES
            if not (model_dir / name).is_file()
        ]
        if missing:
            raise RuntimeError(
                "La descarga de Qwen quedo incompleta. "
                f"Faltan: {', '.join(missing)}. "
                f"Carpeta: {model_dir}"
            )

        model_file = model_dir / "model.safetensors"
        if model_file.stat().st_size < 500_000_000:
            raise RuntimeError(
                "model.safetensors parece incompleto "
                f"({model_file.stat().st_size / 1024 / 1024:.1f} MB). "
                "Elimina la carpeta del modelo y vuelve a descargar."
            )

        print(
            f"Snapshot Qwen listo en {model_dir} "
            f"({model_file.stat().st_size / 1024 / 1024:.0f} MB)"
        )
        return model_dir

    def _load(self) -> None:
        if self._loaded:
            return
        if self._load_error:
            raise RuntimeError(self._load_error)

        with self._lock:
            if self._loaded:
                return
            if self._load_error:
                raise RuntimeError(self._load_error)

            try:
                import torch
                import transformers
                import safetensors
                from transformers import AutoModelForCausalLM, AutoTokenizer

                model_dir = self._ensure_snapshot()

                use_cuda = bool(
                    SENTENCE_AI_USE_GPU and torch.cuda.is_available()
                )
                self._device = "cuda" if use_cuda else "cpu"
                dtype = torch.float16 if use_cuda else torch.float32

                print(
                    "Cargando corrector contextual local..."
                    f"\n  modelo: {model_dir}"
                    f"\n  transformers: {transformers.__version__}"
                    f"\n  safetensors: {getattr(safetensors, '__version__', 'desconocido')}"
                    f"\n  dispositivo: {self._device}"
                )

                tokenizer = AutoTokenizer.from_pretrained(
                    str(model_dir),
                    local_files_only=True,
                )

                model = AutoModelForCausalLM.from_pretrained(
                    str(model_dir),
                    local_files_only=True,
                    use_safetensors=True,
                    dtype=dtype,
                    low_cpu_mem_usage=True,
                )

                model.to(self._device)
                model.eval()

                self._torch = torch
                self._tokenizer = tokenizer
                self._model = model
                self._loaded = True

                print(
                    f"Corrector contextual listo: "
                    f"{SENTENCE_AI_MODEL_ID} ({self._device})"
                )

            except Exception as exc:
                self._load_error = (
                    "No se pudo cargar el modelo contextual. "
                    f"{type(exc).__name__}: {exc}"
                )
                raise RuntimeError(self._load_error) from exc

    @staticmethod
    def _normalize_input(text: str) -> str:
        return " ".join(str(text or "").strip().split())

    @staticmethod
    def _clean_output(text: str) -> str:
        text = str(text or "").strip()

        text = re.sub(
            r"<think>.*?</think>",
            "",
            text,
            flags=re.IGNORECASE | re.DOTALL,
        ).strip()

        text = re.sub(
            r"^(frase\s+corregida|correcci[oó]n|resultado)\s*:\s*",
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()

        if (
            len(text) >= 2
            and text[0] in {'"', "'", "“", "‘"}
            and text[-1] in {'"', "'", "”", "’"}
        ):
            text = text[1:-1].strip()

        return " ".join(text.split())

    @staticmethod
    def _safe_result(original: str, corrected: str) -> str:
        if not corrected:
            return original

        original_words = original.split()
        corrected_words = corrected.split()

        max_words = max(
            len(original_words) + 5,
            int(len(original_words) * 1.8),
        )
        if len(corrected_words) > max_words:
            return original

        if len(corrected) > max(
            len(original) * 3,
            len(original) + 80,
        ):
            return original

        if len(original_words) >= 4 and len(corrected_words) < 2:
            return original

        return corrected

    def correct(
        self,
        sentence: str,
        candidate_context: Optional[list[dict]] = None,
    ) -> dict:
        original = self._normalize_input(sentence)

        if not original:
            return {
                "original": "",
                "corrected": "",
                "changed": False,
                "model": SENTENCE_AI_MODEL_ID,
                "device": self._device,
            }

        if not SENTENCE_AI_ENABLED:
            return {
                "original": original,
                "corrected": original,
                "changed": False,
                "model": SENTENCE_AI_MODEL_ID,
                "device": self._device,
                "disabled": True,
            }

        if len(original.split()) < SENTENCE_AI_MIN_WORDS:
            return {
                "original": original,
                "corrected": original,
                "changed": False,
                "model": SENTENCE_AI_MODEL_ID,
                "device": self._device,
            }

        original = original[:SENTENCE_AI_MAX_INPUT_CHARS]
        self._load()

        candidates_text = ""
        if candidate_context:
            lines = []
            for item in candidate_context[:30]:
                raw = str(item.get("raw", "")).strip()
                options = [
                    str(value).strip()
                    for value in item.get("candidates", [])
                    if str(value).strip()
                ][:6]
                if raw or options:
                    lines.append(
                        f"- {raw}: {', '.join(options)}"
                        if options else f"- {raw}"
                    )
            if lines:
                candidates_text = (
                    "\n\nCandidatos del corrector lexico:\n"
                    + "\n".join(lines)
                )

        system_prompt = (
            "Eres una capa de correccion contextual para un sistema de "
            "reconocimiento de lengua de señas en español. "
            "Algunas palabras pueden contener letras equivocadas. "
            "Corrige ortografia, tildes, puntuacion y palabras evidentemente "
            "mal reconocidas usando el contexto. "
            "Conserva el significado y el orden logico. "
            "No respondas preguntas, no converses, no expliques y no inventes "
            "informacion nueva. Devuelve solamente la oracion corregida."
        )

        user_prompt = (
            f"Oracion reconocida:\n{original}"
            f"{candidates_text}\n\n"
            "Devuelve solo la oracion corregida."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        tokenizer = self._tokenizer
        model = self._model
        torch = self._torch

        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False,
        )

        inputs = tokenizer(
            [prompt],
            return_tensors="pt",
        ).to(self._device)

        with torch.inference_mode():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=SENTENCE_AI_MAX_NEW_TOKENS,
                do_sample=False,
                repetition_penalty=1.05,
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )

        output_ids = generated_ids[0][inputs["input_ids"].shape[-1]:]
        corrected = tokenizer.decode(
            output_ids,
            skip_special_tokens=True,
        )

        corrected = self._clean_output(corrected)
        corrected = self._safe_result(original, corrected)

        return {
            "original": original,
            "corrected": corrected,
            "changed": corrected.casefold() != original.casefold(),
            "model": SENTENCE_AI_MODEL_ID,
            "device": self._device,
        }


sentence_corrector_service = SentenceCorrectorService()
