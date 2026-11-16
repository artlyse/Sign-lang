"""Tablas de datos aportados por los usuarios.

- `TrainingSample`: landmarks capturados durante la práctica. Alimentan el
  modelo personal (k-NN en tiempo real) y pueden exportarse al dataset de
  `ai-training/` para reentrenar los modelos ONNX.
- `UserTemplate`: plantillas rápidas por usuario.
- `UserPreference`: preferencias de interfaz sincronizadas entre dispositivos.

Son tablas nuevas: `create_all` las crea sin tocar las existentes."""

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class TrainingSample(Base):
    __tablename__ = "training_samples"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    attempt_id = Column(
        Integer,
        ForeignKey("practice_attempts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    label = Column(String(20), nullable=False, index=True)
    kind = Column(String(10), nullable=False, index=True)  # static | dynamic
    data_json = Column(Text, nullable=False)  # 63 floats o 30x63 floats

    predicted_label = Column(String(20), nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)

    verified = Column(Boolean, nullable=False, default=False, index=True)
    source = Column(String(30), nullable=False, default="practice")
    exported = Column(Boolean, nullable=False, default=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class UserTemplate(Base):
    __tablename__ = "user_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(60), nullable=False)
    category = Column(String(40), nullable=False, default="General")
    text = Column(Text, nullable=False)
    usage_count = Column(Integer, nullable=False, default=0)
    favorite = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    data_json = Column(Text, nullable=False, default="{}")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
