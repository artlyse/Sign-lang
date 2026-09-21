from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import Base, engine
from app.models import User, Session, Prediction, Word
from app.api import recognition
from app.websocket import recognition_ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    print("Base de datos inicializada")
    from app.services.recognition_service import recognition_service
    print("Servicio de reconocimiento iniciado")
    yield


app = FastAPI(
    title="Reconocimiento de Senas API",
    description="API para reconocimiento de lengua de senas en tiempo real",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar rutas
app.include_router(recognition.router)
app.include_router(recognition_ws_router)


@app.get("/")
def root():
    return {
        "message": "API de Reconocimiento de Senas funcionando",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    return {"status": "ok"}