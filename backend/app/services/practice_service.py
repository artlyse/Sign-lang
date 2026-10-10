"""Lógica del módulo de práctica gamificado.

Genera retos, calcula similitud/precisión, XP, nivel y rachas, y persiste los
intentos por usuario en SQLite."""

from __future__ import annotations

import random
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.practice import PracticeAttempt, PracticeProgress


LETTERS = {
    "beginner": list("AEILMNOSTU"),
    "intermediate": list("BCDFGHKPRV"),
    "advanced": list("JÑQWXYZ"),
}

WORDS = {
    "beginner": [
        "HOLA", "CASA", "AGUA", "AMOR", "MANO", "DIA", "MAMA", "PAPA",
        "AMIGO", "GRACIAS",
    ],
    "intermediate": [
        "FAMILIA", "ESCUELA", "TRABAJO", "COMIDA", "TIEMPO", "PERSONA",
        "SALUD", "CAMINO", "CIUDAD", "AYUDA",
    ],
    "advanced": [
        "COMUNICACION", "APRENDIZAJE", "UNIVERSIDAD", "TECNOLOGIA",
        "EXPERIENCIA", "RECONOCIMIENTO", "RESPONSABILIDAD",
        "DESARROLLO", "INFORMACION", "ACCESIBILIDAD",
    ],
}

FALLBACK_PHRASES = {
    "beginner": [
        "HOLA COMO ESTAS",
        "BUENOS DIAS AMIGO",
        "QUIERO TOMAR AGUA",
        "GRACIAS POR TU AYUDA",
        "HOY ESTOY MUY BIEN",
    ],
    "intermediate": [
        "HOLA COMO ESTAN TODOS",
        "QUIERO APRENDER LENGUA DE SEÑAS",
        "HOY TENGO CLASE EN LA UNIVERSIDAD",
        "GRACIAS POR AYUDARME CON ESTO",
        "MAÑANA VAMOS A PRACTICAR JUNTOS",
    ],
    "advanced": [
        "LA COMUNICACION ACCESIBLE MEJORA LA EXPERIENCIA DE TODOS",
        "QUIERO PRACTICAR PARA COMUNICARME CON MAYOR PRECISION",
        "EL APRENDIZAJE CONSTANTE AYUDA A MEJORAR LA FLUIDEZ",
        "LA TECNOLOGIA PUEDE FACILITAR LA COMUNICACION ENTRE PERSONAS",
    ],
}


def normalize_text(value: str) -> str:
    value = str(value or "").upper().strip()
    # Preservar Ñ al retirar otras tildes.
    value = value.replace("Ñ", "__ENYE__")
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.replace("__ENYE__", "Ñ")
    value = re.sub(r"[^A-ZÑ0-9 ]+", " ", value)
    return " ".join(value.split())


def text_similarity(target: str, recognized: str) -> float:
    a = normalize_text(target)
    b = normalize_text(recognized)
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio() * 100.0


def difficulty_threshold(difficulty: str) -> float:
    return {
        "beginner": 72.0,
        "intermediate": 80.0,
        "advanced": 86.0,
    }.get(difficulty, 72.0)


def target_duration_ms(mode: str, difficulty: str) -> int:
    table = {
        "letter": {
            "beginner": 4500,
            "intermediate": 3500,
            "advanced": 2800,
        },
        "word": {
            "beginner": 14000,
            "intermediate": 11000,
            "advanced": 9000,
        },
        "phrase": {
            "beginner": 34000,
            "intermediate": 28000,
            "advanced": 22000,
        },
    }
    return table.get(mode, table["word"]).get(difficulty, 12000)


def calculate_level(total_xp: int) -> tuple[int, int, int, float]:
    remaining = max(0, int(total_xp))
    level = 1

    while True:
        needed = 300 + (level - 1) * 150
        if remaining < needed:
            progress = (remaining / needed) * 100.0 if needed else 0.0
            return level, remaining, needed, round(progress, 2)
        remaining -= needed
        level += 1


def _progress_row(db: Session, user_id: int) -> PracticeProgress:
    row = db.get(PracticeProgress, user_id)
    if row is None:
        row = PracticeProgress(user_id=user_id)
        db.add(row)
        db.flush()
    return row


def serialize_progress(db: Session, user_id: int) -> dict:
    progress = _progress_row(db, user_id)

    average_accuracy, best_accuracy = db.execute(
        select(
            func.coalesce(func.avg(PracticeAttempt.accuracy), 0.0),
            func.coalesce(func.max(PracticeAttempt.accuracy), 0.0),
        ).where(PracticeAttempt.user_id == user_id)
    ).one()

    level, level_xp, next_level_xp, level_progress = calculate_level(
        progress.total_xp
    )

    attempts = int(progress.total_attempts or 0)
    successful = int(progress.successful_attempts or 0)

    return {
        "level": level,
        "total_xp": int(progress.total_xp or 0),
        "level_xp": level_xp,
        "next_level_xp": next_level_xp,
        "level_progress": level_progress,
        "total_attempts": attempts,
        "successful_attempts": successful,
        "success_rate": round((successful / attempts) * 100.0, 2)
        if attempts
        else 0.0,
        "current_streak": int(progress.current_streak or 0),
        "best_streak": int(progress.best_streak or 0),
        "average_accuracy": round(float(average_accuracy or 0.0), 2),
        "best_accuracy": round(float(best_accuracy or 0.0), 2),
    }


def create_challenge(mode: str, difficulty: str) -> str:
    if mode == "letter":
        return random.choice(LETTERS[difficulty])
    if mode == "word":
        return random.choice(WORDS[difficulty])
    return random.choice(FALLBACK_PHRASES[difficulty])


def record_attempt(
    db: Session,
    user_id: int,
    *,
    mode: str,
    difficulty: str,
    target_text: str,
    recognized_text: str,
    duration_ms: int,
    confidence: float,
) -> dict:
    similarity = text_similarity(target_text, recognized_text)
    confidence_pct = max(0.0, min(100.0, float(confidence) * 100.0))

    # La similitud textual pesa más que la confianza de una sola predicción.
    accuracy = round(similarity * 0.82 + confidence_pct * 0.18, 2)

    threshold = difficulty_threshold(difficulty)
    success = accuracy >= threshold

    base_xp = {
        "letter": 45,
        "word": 85,
        "phrase": 145,
    }.get(mode, 60)

    difficulty_multiplier = {
        "beginner": 1.0,
        "intermediate": 1.25,
        "advanced": 1.55,
    }.get(difficulty, 1.0)

    target_ms = target_duration_ms(mode, difficulty)
    speed_ratio = max(
        0.0,
        min(1.0, (target_ms - max(0, duration_ms)) / max(target_ms, 1)),
    )
    speed_bonus = speed_ratio * 0.30

    accuracy_factor = max(0.25, min(1.0, accuracy / 100.0))
    xp = round(
        base_xp
        * difficulty_multiplier
        * accuracy_factor
        * (1.0 + speed_bonus)
    )

    if not success:
        xp = max(5, round(xp * 0.35))

    progress = _progress_row(db, user_id)
    before_level = calculate_level(progress.total_xp)[0]

    attempt = PracticeAttempt(
        user_id=user_id,
        mode=mode,
        difficulty=difficulty,
        target_text=target_text.strip(),
        recognized_text=recognized_text.strip(),
        accuracy=accuracy,
        confidence=float(confidence),
        duration_ms=int(duration_ms),
        xp_earned=xp,
        success=success,
    )
    db.add(attempt)

    progress.total_xp = int(progress.total_xp or 0) + xp
    progress.total_attempts = int(progress.total_attempts or 0) + 1

    if success:
        progress.successful_attempts = int(progress.successful_attempts or 0) + 1
        progress.current_streak = int(progress.current_streak or 0) + 1
        progress.best_streak = max(
            int(progress.best_streak or 0),
            progress.current_streak,
        )
    else:
        progress.current_streak = 0

    db.commit()
    db.refresh(attempt)
    db.refresh(progress)

    after_level = calculate_level(progress.total_xp)[0]
    level_up = after_level > before_level

    badge = None
    if level_up:
        badge = f"Nivel {after_level} desbloqueado"
    elif success and progress.current_streak in {3, 5, 10, 20}:
        badge = f"Racha de {progress.current_streak}"
    elif accuracy >= 98:
        badge = "Precisión excelente"

    return {
        "attempt": {
            "id": attempt.id,
            "mode": attempt.mode,
            "difficulty": attempt.difficulty,
            "target_text": attempt.target_text,
            "recognized_text": attempt.recognized_text,
            "accuracy": round(attempt.accuracy, 2),
            "confidence": round(attempt.confidence, 4),
            "duration_ms": attempt.duration_ms,
            "xp_earned": attempt.xp_earned,
            "success": bool(attempt.success),
            "created_at": attempt.created_at.isoformat()
            if attempt.created_at
            else None,
        },
        "progress": serialize_progress(db, user_id),
        "level_up": level_up,
        "badge": badge,
    }


def recent_attempts(db: Session, user_id: int, limit: int = 10) -> list[dict]:
    rows: Iterable[PracticeAttempt] = db.scalars(
        select(PracticeAttempt)
        .where(PracticeAttempt.user_id == user_id)
        .order_by(PracticeAttempt.created_at.desc(), PracticeAttempt.id.desc())
        .limit(max(1, min(int(limit), 50)))
    ).all()

    return [
        {
            "id": row.id,
            "mode": row.mode,
            "difficulty": row.difficulty,
            "target_text": row.target_text,
            "recognized_text": row.recognized_text,
            "accuracy": round(row.accuracy, 2),
            "confidence": round(row.confidence, 4),
            "duration_ms": row.duration_ms,
            "xp_earned": row.xp_earned,
            "success": bool(row.success),
            "created_at": row.created_at.isoformat()
            if row.created_at
            else None,
        }
        for row in rows
    ]
