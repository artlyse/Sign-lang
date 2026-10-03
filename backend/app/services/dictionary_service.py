import os
import re
import unicodedata
from typing import List

try:
    from spylls.hunspell import Dictionary
except Exception:  # La app puede arrancar aunque falte la dependencia.
    Dictionary = None

from app.config import (
    LANGUAGE_HUNSPELL_BASE,
    LANGUAGE_HUNSPELL_SUGGESTION_LIMIT,
)


class SpanishDictionaryService:
    """Acceso local al diccionario Hunspell es_PE mediante spylls."""

    def __init__(self):
        self.dictionary = None
        self.available = False
        self.error = None
        self._load()

    def _load(self):
        aff_path = f"{LANGUAGE_HUNSPELL_BASE}.aff"
        dic_path = f"{LANGUAGE_HUNSPELL_BASE}.dic"

        if Dictionary is None:
            self.error = "spylls no esta instalado"
            print(f"ADVERTENCIA diccionario: {self.error}")
            return

        if not os.path.exists(aff_path) or not os.path.exists(dic_path):
            self.error = (
                "faltan es_PE.aff/es_PE.dic; ejecuta "
                "python scripts/download_spanish_dictionary.py"
            )
            print(f"ADVERTENCIA diccionario: {self.error}")
            return

        try:
            # Dictionary.from_files recibe la ruta base SIN extension.
            self.dictionary = Dictionary.from_files(LANGUAGE_HUNSPELL_BASE)
            self.available = True
            self.error = None
            print("Diccionario Hunspell es_PE cargado")
        except Exception as exc:
            self.error = str(exc)
            print(f"ADVERTENCIA cargando diccionario Hunspell: {exc}")

    @staticmethod
    def _clean_for_hunspell(word: str) -> str:
        # Conserva tildes y ñ si ya existen; elimina puntuacion externa.
        text = (word or "").strip().lower()
        text = re.sub(r"^[^a-záéíóúüñ]+|[^a-záéíóúüñ]+$", "", text)
        return text

    @staticmethod
    def normalize_key(text: str) -> str:
        """Clave comparable con el alfabeto manual: sin tildes, conserva Ñ."""
        text = (text or "").strip().upper()
        text = text.replace("Ñ", "__ENYE__")
        text = unicodedata.normalize("NFD", text)
        text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
        text = text.replace("__ENYE__", "Ñ")
        return re.sub(r"[^A-ZÑ]", "", text)

    def lookup(self, word: str) -> bool:
        if not self.available or not self.dictionary:
            return False

        cleaned = self._clean_for_hunspell(word)
        if not cleaned:
            return False

        try:
            return bool(self.dictionary.lookup(cleaned))
        except Exception:
            return False

    def suggest(self, word: str, limit: int = None) -> List[str]:
        """Devuelve sugerencias ortograficas reales del diccionario es_PE."""
        if not self.available or not self.dictionary:
            return []

        cleaned = self._clean_for_hunspell(word)
        if not cleaned:
            return []

        limit = limit or LANGUAGE_HUNSPELL_SUGGESTION_LIMIT
        results: List[str] = []
        seen = set()

        try:
            for candidate in self.dictionary.suggest(cleaned):
                candidate = str(candidate).strip()
                key = self.normalize_key(candidate)
                if not key or key in seen:
                    continue

                seen.add(key)
                results.append(candidate)
                if len(results) >= limit:
                    break
        except Exception as exc:
            print(f"ADVERTENCIA generando sugerencias Hunspell: {exc}")

        return results

    def status(self) -> dict:
        return {
            "available": self.available,
            "base": LANGUAGE_HUNSPELL_BASE,
            "error": self.error,
        }


spanish_dictionary_service = SpanishDictionaryService()
