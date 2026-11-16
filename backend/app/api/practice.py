"""Endpoints del módulo de práctica: retos, progreso e intentos."""

import asyncio

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.practice import PracticeAttemptCreate, PracticeAttemptResult
from app.services.practice_service import (
    create_challenge,
    recent_attempts,
    record_attempt,
    serialize_progress,
)
from app.services.sentence_corrector_service import sentence_corrector_service
from app.services import training_service
from app.services.learning_context import reset_learning_user, set_learning_user
from app.services.learning_service import learning_service
from app.services.practice_service import normalize_text

router = APIRouter(prefix="/api/practice", tags=["practice"])


@router.get("/challenge")
async def get_challenge(
    mode: str = Query("letter", pattern="^(letter|word|phrase)$"),
    difficulty: str = Query(
        "beginner",
        pattern="^(beginner|intermediate|advanced)$",
    ),
    use_ai: bool = Query(True),
    current_user: User = Depends(get_current_user),
):
    del current_user

    source = "library"
    text = create_challenge(mode, difficulty)

    if mode == "phrase" and use_ai:
        try:
            text = await asyncio.to_thread(
                sentence_corrector_service.generate_practice_phrase,
                difficulty,
            )
            source = "qwen"
        except Exception as exc:
            # Practicar debe seguir funcionando aunque Qwen no esté disponible.
            print(f"ADVERTENCIA generando frase de práctica con Qwen: {exc}")
            source = "fallback"

    return {
        "mode": mode,
        "difficulty": difficulty,
        "text": text,
        "source": source,
    }


@router.get("/progress")
def get_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    progress = serialize_progress(db, current_user.id)
    db.commit()
    return {
        "progress": progress,
        "recent_attempts": recent_attempts(db, current_user.id, 8),
    }


@router.post("/attempt", response_model=PracticeAttemptResult)
def save_attempt(
    payload: PracticeAttemptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = record_attempt(
        db,
        current_user.id,
        mode=payload.mode,
        difficulty=payload.difficulty,
        target_text=payload.target_text,
        recognized_text=payload.recognized_text,
        duration_ms=payload.duration_ms,
        confidence=payload.confidence,
    )
    attempt = result["attempt"]

    # 1) Landmarks del reto -> datos de entrenamiento. Se verifican solo si
    #    el reto fue exitoso; si no, el usuario puede confirmarlos después.
    training = {"saved": 0, "skipped": 0, "verified": False}
    if payload.samples:
        training = training_service.save_samples(
            db,
            current_user.id,
            payload.samples,
            verified=bool(attempt["success"]),
            attempt_id=attempt["id"],
        )

    # 2) Palabras/frases -> aprendizaje lingüístico (correcciones y contexto).
    training["language_feedback"] = _learn_language(
        current_user.id,
        payload.mode,
        payload.target_text,
        payload.recognized_text,
    )
    training["personal_model"] = training_service.personal_model_service.status(
        current_user.id
    )
    result["training"] = training
    return result


def _learn_language(user_id: int, mode: str, target: str, recognized: str) -> int:
    if mode == "letter" or not recognized.strip():
        return 0

    target_words = normalize_text(target).split()
    recognized_words = normalize_text(recognized).split()
    if not target_words or len(target_words) != len(recognized_words):
        return 0

    token = set_learning_user(user_id)
    saved = 0
    try:
        for index, (raw, correct) in enumerate(zip(recognized_words, target_words)):
            context = target_words[max(0, index - 2):index]
            outcome = learning_service.record_feedback(
                raw,
                correct,
                context_words=context,
                predicted=raw,
                source="practice",
                weight=0.7,
            )
            if outcome.get("saved", True):
                saved += 1
    except Exception as exc:
        print(f"ADVERTENCIA aprendizaje desde práctica: {exc}")
    finally:
        reset_learning_user(token)
    return saved
