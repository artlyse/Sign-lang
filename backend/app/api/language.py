"""Endpoints de diccionario, sugerencias y compatibilidad de estadísticas lingüísticas."""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user, get_optional_user
from app.models.user import User
from app.services.dictionary_service import spanish_dictionary_service
from app.services.learning_context import reset_learning_user, set_learning_user
from app.services.language_service import language_service

router = APIRouter(prefix="/api/language", tags=["language"])


@router.get("/suggest")
def suggest_word(
    word: str = Query(..., min_length=1),
    previous_word: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user),
):
    token = set_learning_user(current_user.id if current_user else None)
    try:
        context = [previous_word] if previous_word else []
        return {
            "raw": word,
            "previous_word": previous_word,
            "suggestions": language_service.suggest(word, context_words=context),
        }
    finally:
        reset_learning_user(token)


@router.get("/lookup")
def lookup_word(word: str = Query(..., min_length=1)):
    return {
        "word": word,
        "exists": spanish_dictionary_service.lookup(word),
        "dictionary": "es_PE",
    }


@router.get("/dictionary-suggest")
def dictionary_suggest(word: str = Query(..., min_length=1)):
    return {
        "word": word,
        "dictionary": "es_PE",
        "suggestions": spanish_dictionary_service.suggest(word, limit=20),
    }


@router.get("/learning/stats")
def learning_stats(current_user: User = Depends(get_current_user)):
    token = set_learning_user(current_user.id)
    try:
        return language_service.learning_stats()
    finally:
        reset_learning_user(token)


@router.get("/learning/recent")
def learning_recent(
    limit: int = Query(20, ge=1, le=200),
    current_user: User = Depends(get_current_user),
):
    token = set_learning_user(current_user.id)
    try:
        return {"items": language_service.recent_feedback(limit=limit)}
    finally:
        reset_learning_user(token)


@router.get("/health")
def language_health():
    return {
        "status": "ok",
        "dictionary": spanish_dictionary_service.status(),
    }


from pydantic import BaseModel, Field
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from app.services.sentence_corrector_service import sentence_corrector_service

class SentenceCorrectionInput(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    candidate_context: list[dict] = Field(default_factory=list)


def _punctuation_fallback(text: str) -> str:
    """Reglas conservadoras para frases frecuentes cuando Qwen no cambia el texto."""
    import re
    value = re.sub(r"\\s+", " ", text.strip())
    value = value[0].upper() + value[1:] if value else value
    normalized = value.casefold().strip(" .!?¿¡")
    if normalized.startswith("hola como estas"):
        remainder = normalized[len("hola como estas"):]
        return "Hola, ¿cómo estás?" + (" " + remainder.capitalize() if remainder else "")
    if normalized.startswith("hola como esta"):
        remainder = normalized[len("hola como esta"):]
        return "Hola, ¿cómo está?" + (" " + remainder.capitalize() if remainder else "")
    question_starts = ("como estas", "como esta", "que tal", "cuanto cuesta", "cuanto es",
                       "donde esta", "donde queda", "que hora es", "puedes ayudarme",
                       "cual es", "que necesitas", "que deseas")
    if any(normalized.startswith(q) for q in question_starts):
        value = value.rstrip(" .!?¿¡")
        if not value.startswith("¿"): value = "¿" + value
        if not value.endswith("?"): value += "?"
        value = value.replace("Como", "Cómo", 1).replace("como", "cómo", 1) if normalized.startswith("como") else value
        value = value.replace("Cuanto", "Cuánto", 1).replace("cuanto", "cuánto", 1) if normalized.startswith("cuanto") else value
        value = value.replace("Donde", "Dónde", 1).replace("donde", "dónde", 1) if normalized.startswith("donde") else value
        value = value.replace("Cual", "Cuál", 1).replace("cual", "cuál", 1) if normalized.startswith("cual") else value
        return value
    if not value.endswith((".", "!", "?")): value += "."
    return value


@router.post("/correct-sentence")
async def correct_sentence(payload: SentenceCorrectionInput, current_user: User = Depends(get_current_user)):
    original = payload.text.strip()
    try:
        result = await run_in_threadpool(sentence_corrector_service.correct, original, payload.candidate_context)
        corrected = result.get("corrected") or original
        # Qwen puede estar deshabilitado/no disponible o no resolver puntuación.
        fallback = _punctuation_fallback(corrected)
        if fallback and (not result.get("changed") or corrected == original):
            corrected = fallback
        result.update({"original": original, "corrected": corrected,
                       "changed": corrected.casefold() != original.casefold()})
        return result
    except Exception:
        corrected = _punctuation_fallback(original)
        return {"original": original, "corrected": corrected,
                "changed": corrected.casefold() != original.casefold(),
                "model": "rules-fallback", "device": "cpu", "fallback": True}
