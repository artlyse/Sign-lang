# Modelo Prediction 
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base


class Prediction(Base):
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    text = Column(String(255), nullable=False)
    translation = Column(String(255), nullable=True)
    confidence = Column(Float, nullable=False)
    mode = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())