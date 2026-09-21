# Modelo Word 
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Word(Base):
    __tablename__ = "words"
    
    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(255), unique=True, nullable=False, index=True)
    language = Column(String(10), default="es")
    frequency = Column(Integer, default=1)
    category = Column(String(50), default="general")
    created_at = Column(DateTime(timezone=True), server_default=func.now())