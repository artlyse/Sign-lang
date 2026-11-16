"""Plantillas compartidas, muestras etiquetadas y enrolamiento facial."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Boolean, LargeBinary, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base

class PhraseTemplate(Base):
    __tablename__ = "phrase_templates"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(30), nullable=False, default="Personalizada")
    description = Column(String(500), nullable=False, default="")
    phrases_json = Column(Text, nullable=False)
    triggers_json = Column(Text, nullable=False, default="[]")
    is_public = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class GestureSample(Base):
    __tablename__ = "gesture_samples"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(80), nullable=False, index=True)
    description = Column(String(300), nullable=False, default="")
    frames_json = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class FaceEnrollment(Base):
    __tablename__ = "face_enrollments"
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    image_path = Column(String(500), nullable=False, default="")
    image_data = Column(LargeBinary, nullable=True)
    embedding_json = Column(Text, nullable=True)
    consent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
