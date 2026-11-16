from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Literal

Category = Literal["Negocio", "General", "Educación", "Salud", "Personalizada"]
class TemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    category: Category = "Personalizada"
    description: str = Field(default="", max_length=500)
    phrases: list[str] = Field(min_length=1, max_length=100)
    triggers: list[str] = Field(default_factory=list, max_length=100)
    # Las plantillas de un usuario aparecen en las demás cuentas salvo que
    # el autor las marque como privadas.
    shared: bool = True
class TemplateOut(BaseModel):
    id: int
    name: str
    category: str
    description: str
    phrases: list[str]
    triggers: list[str]
    owner: str
    shared: bool
    updatedAt: datetime | None = None
class GestureCreate(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=300)
    frames: list[str] = Field(min_length=5, max_length=120)
class GestureOut(BaseModel):
    id: int
    label: str
    description: str
    frame_count: int
    status: str
    created_at: datetime
class FaceStatus(BaseModel):
    enrolled: bool
    consent_required: bool = True
