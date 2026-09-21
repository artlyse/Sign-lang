# Configuracion del proyecto 
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "signlang-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Rutas de modelos
AI_MODELS_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "ai", "models"
)

GESTURE_MODEL_PATH = os.path.join(AI_MODELS_DIR, "gesture_model.onnx")
LSTM_MODEL_PATH = os.path.join(AI_MODELS_DIR, "lstm_model.onnx")
SCALER_STATIC_PATH = os.path.join(AI_MODELS_DIR, "scaler_static.pkl")
SCALER_DYNAMIC_PATH = os.path.join(AI_MODELS_DIR, "scaler_dynamic.pkl")

LETRAS_STATIC = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
SENAS_DYNAMIC = ["J", "N", "Z"]