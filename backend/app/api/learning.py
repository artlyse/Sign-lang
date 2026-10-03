from fastapi import APIRouter, Depends, Query

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.learning_context import reset_learning_user, set_learning_user
from app.services.language_service import language_service

router = APIRouter(prefix="/api/learning", tags=["learning"])


@router.get("/stats")
def stats(current_user: User = Depends(get_current_user)):
    token = set_learning_user(current_user.id)
    try:
        return language_service.learning_stats()
    finally:
        reset_learning_user(token)


@router.get("/recent")
def recent(
    limit: int = Query(20, ge=1, le=200),
    current_user: User = Depends(get_current_user),
):
    token = set_learning_user(current_user.id)
    try:
        return {"items": language_service.recent_feedback(limit)}
    finally:
        reset_learning_user(token)
