# Servicio de autenticacion 
from pydantic import BaseModel
from typing import List, Optional


class LandmarksInput(BaseModel):
    landmarks: List[float]  # 63 valores


class SequenceInput(BaseModel):
    sequence: List[List[float]]  # 30 x 63


class PredictionResponse(BaseModel):
    letter: str
    confidence: float
    mode: str