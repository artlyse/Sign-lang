"""Punto de entrada FastAPI de SignLang.

Registra routers REST/WebSocket, CORS y el ciclo de vida de la aplicación.
Durante startup crea tablas faltantes y carga los servicios principales para
detectar temprano errores de modelos o diccionarios."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, face, gestures, language, learning, practice, recognition, sessions, templates, training, users
from app.config import APP_NAME, CORS_ORIGINS, ENVIRONMENT
from app.database import database_health, init_db
from app.websocket import recognition_ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _seed_builtin_templates()
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
app.include_router(practice.router)
app.include_router(training.router)
app.include_router(templates.router)
app.include_router(gestures.router)
app.include_router(face.router)
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


# Paquetes de frases públicos que se crean una sola vez (owner_id = NULL).
BUILTIN_TEMPLATES = [
    ("Atención de negocio", "Negocio", "Compras, precios y consultas en un negocio.",
     ["¡Hola! Soy {nombre}, quisiera hacer una consulta.", "¿Cuánto cuesta?",
      "Quisiera comprar este producto.", "¿Aceptan pago con tarjeta?", "¿Tienen otro color o talla?",
      "Gracias por su atención."],
     ["hola", "buenas", "precio", "cuanto", "comprar", "producto", "gracias"]),
    ("Conversación general", "General", "Saludos y frases comunes para conversar.",
     ["¡Hola! Me llamo {nombre}.", "Hola, soy {nombre}. ¿Cómo estás?", "¡Hola! ¿Cómo estás?",
      "Mucho gusto, soy {nombre}.", "Estoy bien, gracias. ¿Y tú?", "¿Puedes repetirlo, por favor?",
      "Muchas gracias.", "Hasta luego, gracias por tu ayuda."],
     ["hola", "como", "estas", "gusto", "repetir", "gracias", "adios", "chau"]),
    ("Trámites y orientación", "General", "Ventanilla, pagos y ubicación de oficinas.",
     ["Hola, mi nombre es {nombre} y vengo a realizar un trámite.", "¿Dónde debo hacer la fila?",
      "Aquí está mi documento de identidad.", "¿Dónde firmo?", "¿Cuánto tengo que pagar?",
      "¿Dónde queda el baño?", "Gracias por su ayuda."],
     ["tramite", "documento", "dni", "firma", "pago", "pagar", "donde", "oficina", "baño"]),
    ("Aula y educación", "Educación", "Comunicación en un entorno académico.",
     ["Hola, soy {nombre}, estudiante de esta clase.", "¿Puedes explicarlo nuevamente?",
      "¿Cuál es la tarea?", "No entendí esta parte.", "¿A qué hora comienza la clase?"],
     ["clase", "tarea", "profesor", "explicar"]),
    ("Atención de salud", "Salud", "Comunicación básica en centros de salud.",
     ["Hola, me llamo {nombre} y necesito atención médica.", "Necesito ayuda, por favor.",
      "Me duele aquí.", "Tengo dolor desde ayer.", "Soy alérgico a un medicamento.",
      "Necesito un intérprete de lengua de señas."],
     ["ayuda", "dolor", "medico", "salud", "emergencia"]),
]


def _seed_builtin_templates():
    import json
    from app.database import SessionLocal
    from app.models.community import PhraseTemplate

    with SessionLocal() as db:
        for name, category, description, phrases, triggers in BUILTIN_TEMPLATES:
            exists = db.query(PhraseTemplate).filter_by(owner_id=None, name=name).first()
            if exists:
                # Los paquetes del sistema se mantienen al día con este archivo.
                exists.category = category
                exists.description = description
                exists.phrases_json = json.dumps(phrases, ensure_ascii=False)
                exists.triggers_json = json.dumps(triggers, ensure_ascii=False)
                exists.is_public = True
            else:
                db.add(PhraseTemplate(
                    owner_id=None, name=name, category=category, description=description,
                    phrases_json=json.dumps(phrases, ensure_ascii=False),
                    triggers_json=json.dumps(triggers, ensure_ascii=False),
                    is_public=True,
                ))
        db.commit()
