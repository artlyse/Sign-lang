from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.session import Session as RecognitionSession
from app.models.user import User

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("")
def my_sessions(
    limit: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.scalars(
        select(RecognitionSession)
        .where(RecognitionSession.user_id == current_user.id)
        .order_by(RecognitionSession.id.desc())
        .limit(limit)
    ).all()
    return {
        "items": [
            {
                "id": row.id,
                "mode": row.mode,
                "started_at": row.started_at,
                "ended_at": row.ended_at,
                "total_predictions": row.total_predictions,
            }
            for row in rows
        ]
    }


@router.get("/{session_id}/predictions")
def session_predictions(
    session_id: int,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.prediction import Prediction

    session_row = db.get(RecognitionSession, session_id)
    if session_row is None or session_row.user_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    rows = db.scalars(
        select(Prediction)
        .where(Prediction.session_id == session_id)
        .order_by(Prediction.id.asc())
        .limit(limit)
    ).all()
    return {
        "session_id": session_id,
        "items": [
            {
                "id": row.id,
                "text": row.text,
                "confidence": row.confidence,
                "mode": row.mode,
                "created_at": row.created_at,
            }
            for row in rows
        ],
    }
