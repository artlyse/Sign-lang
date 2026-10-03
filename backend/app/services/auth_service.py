from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.security import (
    create_access_token,
    create_refresh_token_value,
    hash_password,
    refresh_token_expiry,
    refresh_token_hash,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.user_profile import UserProfile


def _aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class AuthService:
    def register(
        self,
        db: Session,
        username: str,
        email: str,
        password: str,
        display_name: str | None = None,
    ) -> User:
        username = username.strip()
        email = email.strip().lower()

        exists = db.scalar(
            select(User).where(or_(User.username == username, User.email == email))
        )
        if exists:
            raise ValueError("El usuario o correo ya está registrado")

        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            is_active=True,
        )
        db.add(user)
        db.flush()

        db.add(
            UserProfile(
                user_id=user.id,
                display_name=display_name.strip() if display_name else None,
                locale="es-PE",
                learning_enabled=True,
                implicit_learning_enabled=True,
            )
        )
        db.commit()
        db.refresh(user)
        return user

    def authenticate(self, db: Session, login: str, password: str) -> User | None:
        login = login.strip()
        user = db.scalar(
            select(User).where(
                or_(User.username == login, User.email == login.lower())
            )
        )
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def issue_tokens(self, db: Session, user: User) -> dict:
        access_token = create_access_token(user.id, user.username)
        refresh_value = create_refresh_token_value()

        db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=refresh_token_hash(refresh_value),
                expires_at=refresh_token_expiry(),
            )
        )
        db.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_value,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    def rotate_refresh_token(self, db: Session, refresh_value: str) -> tuple[User, dict] | None:
        token_hash = refresh_token_hash(refresh_value)
        row = db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        if not row or row.revoked_at is not None:
            return None

        if _aware_utc(row.expires_at) <= datetime.now(timezone.utc):
            return None

        user = db.get(User, row.user_id)
        if not user or not user.is_active:
            return None

        row.revoked_at = datetime.now(timezone.utc)
        db.commit()
        return user, self.issue_tokens(db, user)

    def revoke_refresh_token(self, db: Session, refresh_value: str) -> bool:
        token_hash = refresh_token_hash(refresh_value)
        row = db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        if not row:
            return False
        if row.revoked_at is None:
            row.revoked_at = datetime.now(timezone.utc)
            db.commit()
        return True


auth_service = AuthService()
