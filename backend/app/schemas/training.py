"""Esquemas Pydantic de muestras de entrenamiento, plantillas y preferencias."""

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class TrainingSampleIn(BaseModel):
    label: str = Field(min_length=1, max_length=20)
    kind: Literal["static", "dynamic"] = "static"
    landmarks: list[float] | None = None
    sequence: list[list[float]] | None = None
    predicted_label: str | None = Field(default=None, max_length=20)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _check_shape(self):
        if self.kind == "static":
            if not self.landmarks or len(self.landmarks) != 63:
                raise ValueError("Una muestra estática necesita 63 valores")
        else:
            if (
                not self.sequence
                or len(self.sequence) != 30
                or any(len(frame) != 63 for frame in self.sequence)
            ):
                raise ValueError("Una muestra dinámica necesita 30 frames de 63 valores")
        return self


class TrainingSamplesCreate(BaseModel):
    attempt_id: int | None = None
    verified: bool = True
    samples: list[TrainingSampleIn] = Field(min_length=1, max_length=60)


class TemplateIn(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    category: str = Field(default="General", min_length=1, max_length=40)
    text: str = Field(min_length=1, max_length=500)
    favorite: bool = False


class TemplateUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=60)
    category: str | None = Field(default=None, min_length=1, max_length=40)
    text: str | None = Field(default=None, min_length=1, max_length=500)
    favorite: bool | None = None


class PreferencesIn(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
