"""Endpoints de datos de entrenamiento aportados por el usuario."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.practice import PracticeAttempt
from app.models.user import User
from app.schemas.training import TrainingSamplesCreate
from app.services import training_service

router = APIRouter(prefix="/api/training", tags=["training"])


@router.get("/stats")
def training_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return training_service.stats(db, current_user.id)


@router.get("/samples")
def training_samples(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"items": training_service.recent_samples(db, current_user.id, limit)}


@router.post("/samples")
def add_samples(
    payload: TrainingSamplesCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.attempt_id is not None:
        attempt = db.get(PracticeAttempt, payload.attempt_id)
        if attempt is None or attempt.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Intento no encontrado")

    result = training_service.save_samples(
        db,
        current_user.id,
        payload.samples,
        verified=payload.verified,
        attempt_id=payload.attempt_id,
        source="manual",
    )
    return {**result, "stats": training_service.stats(db, current_user.id)}


@router.post("/attempts/{attempt_id}/confirm")
def confirm_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El usuario indica que su seña era correcta aunque el modelo falló."""
    attempt = db.get(PracticeAttempt, attempt_id)
    if attempt is None or attempt.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    if attempt.mode != "letter":
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden confirmar retos de una letra",
        )

    verified = training_service.verify_attempt_samples(
        db, current_user.id, attempt_id, attempt.target_text
    )
    return {"verified": verified, "stats": training_service.stats(db, current_user.id)}


@router.post("/export")
def export_dataset(
    include_exported: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return training_service.export_samples(db, current_user.id, include_exported)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo escribir el dataset: {exc}")


@router.delete("/samples")
def reset_samples(
    label: str | None = Query(None, max_length=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = training_service.delete_samples(db, current_user.id, label)
    return {"deleted": deleted, "stats": training_service.stats(db, current_user.id)}
