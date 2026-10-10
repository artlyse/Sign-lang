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
    return record_attempt(
        db,
        current_user.id,
        mode=payload.mode,
        difficulty=payload.difficulty,
        target_text=payload.target_text,
        recognized_text=payload.recognized_text,
        duration_ms=payload.duration_ms,
        confidence=payload.confidence,
    )
