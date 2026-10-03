from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, language, learning, recognition, sessions, users
from app.config import APP_NAME, CORS_ORIGINS, ENVIRONMENT
from app.database import database_health, init_db
from app.websocket import recognition_ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("Base de datos inicializada; tablas verificadas/creadas")

    # Carga temprana: si falta un modelo o diccionario lo verás al arrancar.
    from app.services.recognition_service import recognition_service  # noqa: F401
    from app.services.language_service import language_service  # noqa: F401

    print("Servicios de reconocimiento y lenguaje iniciados")
    yield


app = FastAPI(
    title=APP_NAME,
    description="API de reconocimiento de lengua de señas con usuarios y aprendizaje adaptativo",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(recognition.router)
app.include_router(language.router)
app.include_router(learning.router)
app.include_router(recognition_ws_router)


@app.get("/")
def root():
    return {
        "message": "SignLang API funcionando",
        "version": "2.0.0",
        "environment": ENVIRONMENT,
    }


@app.get("/health")
def health():
    db = database_health()
    return {
        "status": "ok" if db.get("ok") else "degraded",
        "database": db,
    }
