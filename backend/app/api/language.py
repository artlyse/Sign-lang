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
