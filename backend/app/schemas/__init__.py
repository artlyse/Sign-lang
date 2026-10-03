# Esquemas Pydantic 
from pydantic import BaseModel, Field
from typing import List


class LandmarksInput(BaseModel):
    landmarks: List[float] = Field(
        ...,
        min_length=63,
        max_length=63,
        description="Lista de 63 valores (21 landmarks x 3 coordenadas)"
    )


class SequenceInput(BaseModel):
    sequence: List[List[float]] = Field(
        ...,
        description="Secuencia de 30 frames, cada uno con 63 valores"
    )


class PredictionResponse(BaseModel):
    letter: str
    confidence: float
    mode: str