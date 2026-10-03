from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    is_active: bool
    created_at: datetime


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    display_name: str | None
    locale: str
    learning_enabled: bool
    implicit_learning_enabled: bool


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
    locale: str | None = Field(default=None, max_length=20)
    learning_enabled: bool | None = None
    implicit_learning_enabled: bool | None = None
