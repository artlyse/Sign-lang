"""Esquemas Pydantic del módulo de práctica."""

from typing import Literal

from pydantic import BaseModel, Field


PracticeMode = Literal["letter", "word", "phrase"]
PracticeDifficulty = Literal["beginner", "intermediate", "advanced"]


class PracticeAttemptCreate(BaseModel):
    mode: PracticeMode
    difficulty: PracticeDifficulty
    target_text: str = Field(min_length=1, max_length=300)
    recognized_text: str = Field(default="", max_length=500)
    duration_ms: int = Field(ge=0, le=3_600_000)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class PracticeAttemptResponse(BaseModel):
    id: int
    mode: str
    difficulty: str
    target_text: str
    recognized_text: str
    accuracy: float
    confidence: float
    duration_ms: int
    xp_earned: int
    success: bool
    created_at: str | None = None


class PracticeProgressResponse(BaseModel):
    level: int
    total_xp: int
    level_xp: int
    next_level_xp: int
    level_progress: float
    total_attempts: int
    successful_attempts: int
    success_rate: float
    current_streak: int
    best_streak: int
    average_accuracy: float
    best_accuracy: float


class PracticeAttemptResult(BaseModel):
    attempt: PracticeAttemptResponse
    progress: PracticeProgressResponse
    level_up: bool
    badge: str | None = None
