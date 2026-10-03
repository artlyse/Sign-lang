from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.user import UserProfileResponse, UserProfileUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


def _get_or_create_profile(db: Session, user_id: int) -> UserProfile:
    profile = db.get(UserProfile, user_id)
    if profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("/me/profile", response_model=UserProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create_profile(db, current_user.id)


@router.patch("/me/profile", response_model=UserProfileResponse)
def update_my_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = _get_or_create_profile(db, current_user.id)
    values = payload.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile
