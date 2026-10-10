"""Modelos SQL del progreso e historial del módulo de práctica."""

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class PracticeProgress(Base):
    __tablename__ = "practice_progress"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    total_xp = Column(Integer, nullable=False, default=0)
    total_attempts = Column(Integer, nullable=False, default=0)
    successful_attempts = Column(Integer, nullable=False, default=0)
    current_streak = Column(Integer, nullable=False, default=0)
    best_streak = Column(Integer, nullable=False, default=0)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class PracticeAttempt(Base):
    __tablename__ = "practice_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    mode = Column(String(20), nullable=False, index=True)
    difficulty = Column(String(20), nullable=False, index=True)

    target_text = Column(Text, nullable=False)
    recognized_text = Column(Text, nullable=False)

    accuracy = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    duration_ms = Column(Integer, nullable=False)

    xp_earned = Column(Integer, nullable=False, default=0)
    success = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
