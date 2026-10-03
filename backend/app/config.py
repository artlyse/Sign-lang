import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

APP_NAME = os.getenv("APP_NAME", "SignLang API")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# -----------------------------------------------------------------------------
# Base de datos
# -----------------------------------------------------------------------------
DEFAULT_SQLITE_PATH = DATA_DIR / "app.db"
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}",
)
SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"

# -----------------------------------------------------------------------------
# Seguridad / usuarios
# -----------------------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "CAMBIA-ESTA-CLAVE-EN-PRODUCCION")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
WS_REQUIRE_AUTH = os.getenv("WS_REQUIRE_AUTH", "false").lower() == "true"

# -----------------------------------------------------------------------------
# CORS
# -----------------------------------------------------------------------------
def _csv_env(name: str, default: str):
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]

CORS_ORIGINS = _csv_env(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
)

# -----------------------------------------------------------------------------
# Rutas de modelos IA
# -----------------------------------------------------------------------------
AI_MODELS_DIR = APP_DIR / "ai" / "models"
GESTURE_MODEL_PATH = str(AI_MODELS_DIR / "gesture_model.onnx")
LSTM_MODEL_PATH = str(AI_MODELS_DIR / "lstm_model.onnx")
SCALER_STATIC_PATH = str(AI_MODELS_DIR / "scaler_static.pkl")
SCALER_DYNAMIC_PATH = str(AI_MODELS_DIR / "scaler_dynamic.pkl")

LETRAS_STATIC = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
SENAS_DYNAMIC = ["J", "Ñ", "Z"]

# -----------------------------------------------------------------------------
# Rendimiento / reconocimiento híbrido
# -----------------------------------------------------------------------------
# El front debe enviar ~30 FPS. El estático usa todos; el dinámico toma 1 de cada 2.
RECOGNITION_INPUT_FPS = int(os.getenv("RECOGNITION_INPUT_FPS", "30"))
HYBRID_DYNAMIC_SAMPLE_FPS = int(os.getenv("HYBRID_DYNAMIC_SAMPLE_FPS", "15"))
HYBRID_DYNAMIC_SAMPLE_EVERY = max(
    1,
    round(RECOGNITION_INPUT_FPS / max(HYBRID_DYNAMIC_SAMPLE_FPS, 1)),
)
HYBRID_DYNAMIC_SAMPLE_INTERVAL_MS = 1000.0 / max(HYBRID_DYNAMIC_SAMPLE_FPS, 1)

HYBRID_SEQUENCE_FRAMES = 30
HYBRID_DYNAMIC_EVAL_STRIDE = 3
HYBRID_MOTION_THRESHOLD = 0.018
HYBRID_SPREAD_THRESHOLD = 0.035
HYBRID_DYNAMIC_CONFIDENCE = 0.80
HYBRID_DYNAMIC_CONFIRMATIONS = 2
HYBRID_DYNAMIC_HOLD_FRAMES = 18
HYBRID_BLOCK_STATIC_DYNAMIC_LETTERS = {"J", "Z"}

# Suavizado rápido para evitar parpadeos de una sola predicción errónea.
HYBRID_STATIC_VOTE_WINDOW = 5
HYBRID_STATIC_MIN_VOTES = 3
HYBRID_STATIC_MIN_CONFIDENCE = 0.70

# -----------------------------------------------------------------------------
# Lenguaje / diccionario
# -----------------------------------------------------------------------------
LANGUAGE_DATA_DIR = APP_DIR / "data"
LANGUAGE_CONFUSION_MATRIX_PATH = str(LANGUAGE_DATA_DIR / "confusion_matrix.json")
LANGUAGE_BIGRAMS_PATH = str(LANGUAGE_DATA_DIR / "bigrams.json")
LANGUAGE_CUSTOM_WORDS_PATH = str(LANGUAGE_DATA_DIR / "custom_words.json")

LANGUAGE_HUNSPELL_DIR = LANGUAGE_DATA_DIR / "hunspell"
LANGUAGE_HUNSPELL_BASE = str(LANGUAGE_HUNSPELL_DIR / "es_PE")
LANGUAGE_HUNSPELL_SUGGESTION_LIMIT = 80

LANGUAGE_MAX_VOCABULARY = 180000
LANGUAGE_PREFIX_COMPLETION_LIMIT = 60
LANGUAGE_SUGGESTION_LIMIT = 5

# A 30 FPS, 3 frames ~100 ms. El suavizado híbrido ya filtra ruido.
LANGUAGE_STATIC_MIN_CONFIDENCE = 0.82
LANGUAGE_DYNAMIC_MIN_CONFIDENCE = 0.80

# -----------------------------------------------------------------------------
# Estabilidad temporal de letras
# -----------------------------------------------------------------------------
# Una prediccion no entra inmediatamente a la palabra. Debe mantenerse
# estable este tiempo para evitar capturar posturas de transicion.
LANGUAGE_STATIC_HOLD_MS = 380
LANGUAGE_DYNAMIC_HOLD_MS = 260

# Pausa minima despues de aceptar una letra antes de permitir otra distinta.
# Esto evita cadenas aleatorias al mover la mano entre dos señas.
LANGUAGE_LETTER_COOLDOWN_MS = 260

# Aun usando tiempo real, exigimos algunos frames consecutivos como filtro
# adicional ante picos aislados del clasificador.
LANGUAGE_STATIC_STABLE_FRAMES = 5


LANGUAGE_AUTO_ACCEPT_SCORE = float(os.getenv("LANGUAGE_AUTO_ACCEPT_SCORE", "0.74"))
LANGUAGE_AUTO_ACCEPT_MARGIN = float(os.getenv("LANGUAGE_AUTO_ACCEPT_MARGIN", "0.045"))

# Regla especial para secuencias que NO existen en el diccionario.
# Ejemplo: HBXA -> HOLA. Se permite un umbral algo menor porque la palabra
# cruda ya sabemos que no es una palabra valida. Esta regla NO acepta
# completaciones de prefijo (HOL -> HOLA) automaticamente.
LANGUAGE_UNKNOWN_AUTO_ACCEPT_SCORE = float(
    os.getenv("LANGUAGE_UNKNOWN_AUTO_ACCEPT_SCORE", "0.66")
)
LANGUAGE_UNKNOWN_AUTO_ACCEPT_MARGIN = float(
    os.getenv("LANGUAGE_UNKNOWN_AUTO_ACCEPT_MARGIN", "0.015")
)
LANGUAGE_UNKNOWN_AUTO_ACCEPT_MAX_DISTANCE = float(
    os.getenv("LANGUAGE_UNKNOWN_AUTO_ACCEPT_MAX_DISTANCE", "2.25")
)
LANGUAGE_UNKNOWN_AUTO_ACCEPT_MIN_SIMILARITY = float(
    os.getenv("LANGUAGE_UNKNOWN_AUTO_ACCEPT_MIN_SIMILARITY", "0.55")
)

# -----------------------------------------------------------------------------
# Aprendizaje adaptativo
# -----------------------------------------------------------------------------
LANGUAGE_ML_DIR = APP_DIR / "ml"
LANGUAGE_ML_DIR.mkdir(parents=True, exist_ok=True)
LANGUAGE_RANKER_MODEL_PATH = str(LANGUAGE_ML_DIR / "language_ranker.joblib")
LANGUAGE_RANKER_MAX_WEIGHT = 0.28
LANGUAGE_RANKER_WARMUP_FEEDBACK = 30
LANGUAGE_RANKER_NEGATIVE_EXAMPLES = 5

LANGUAGE_LEARNING_MIN_CONFUSION_COUNT = 2
LANGUAGE_LEARNING_CONFUSION_FULL_WEIGHT = 8

# Aprendizaje implícito: si el usuario continúa escribiendo sin corregir la
# palabra previa, cuenta como evidencia débil. No entrena directamente el SGD.
IMPLICIT_LEARNING_ENABLED = os.getenv("IMPLICIT_LEARNING_ENABLED", "true").lower() == "true"
IMPLICIT_LEARNING_WEIGHT = float(os.getenv("IMPLICIT_LEARNING_WEIGHT", "0.20"))
IMPLICIT_LEARNING_MIN_SCORE = float(os.getenv("IMPLICIT_LEARNING_MIN_SCORE", "0.88"))
IMPLICIT_LEARNING_MIN_MARGIN = float(os.getenv("IMPLICIT_LEARNING_MIN_MARGIN", "0.10"))

# -----------------------------------------------------------------------------
# Corrector contextual de oraciones - Qwen local
# -----------------------------------------------------------------------------
SENTENCE_AI_ENABLED = os.getenv("SENTENCE_AI_ENABLED", "true").lower() == "true"
SENTENCE_AI_MODEL_ID = os.getenv("SENTENCE_AI_MODEL_ID", "Qwen/Qwen3-0.6B")

SENTENCE_AI_LOCAL_DIR = os.getenv(
    "SENTENCE_AI_LOCAL_DIR",
    str(DATA_DIR / "models" / "qwen3-0.6b"),
)
SENTENCE_AI_CACHE_DIR = os.getenv(
    "SENTENCE_AI_CACHE_DIR",
    str(DATA_DIR / "models" / "huggingface"),
)
SENTENCE_AI_MAX_NEW_TOKENS = int(os.getenv("SENTENCE_AI_MAX_NEW_TOKENS", "96"))
SENTENCE_AI_MAX_INPUT_CHARS = int(os.getenv("SENTENCE_AI_MAX_INPUT_CHARS", "600"))
SENTENCE_AI_MIN_WORDS = int(os.getenv("SENTENCE_AI_MIN_WORDS", "2"))
SENTENCE_AI_USE_GPU = os.getenv("SENTENCE_AI_USE_GPU", "true").lower() == "true"
