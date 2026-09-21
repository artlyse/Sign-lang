# Rutas de reconocimiento 
from fastapi import APIRouter, HTTPException
from app.schemas import LandmarksInput, SequenceInput, PredictionResponse
from app.services.recognition_service import recognition_service

router = APIRouter(prefix="/api/recognition", tags=["Reconocimiento"])


@router.post("/predict-static", response_model=PredictionResponse)
def predict_static(data: LandmarksInput):
    """
    Predice una letra estatica a partir de los landmarks de una mano.
    """
    result = recognition_service.predict_static(data.landmarks)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/predict-dynamic", response_model=PredictionResponse)
def predict_dynamic(data: SequenceInput):
    """
    Predice una sena dinamica a partir de una secuencia de 30 frames.
    """
    result = recognition_service.predict_dynamic(data.sequence)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/models")
def list_models():
    """
    Lista los modelos disponibles.
    """
    return {
        "static": recognition_service.static_session is not None,
        "dynamic": recognition_service.dynamic_session is not None,
        "letters": "A-Z",
        "dynamic_signs": ["J", "N", "Z"]
    }