# Servicio de reconocimiento 
import onnxruntime as ort
import numpy as np
import joblib
import os
from app.config import (
    GESTURE_MODEL_PATH, LSTM_MODEL_PATH,
    SCALER_STATIC_PATH, SCALER_DYNAMIC_PATH,
    LETRAS_STATIC, SENAS_DYNAMIC
)


class RecognitionService:
    def __init__(self):
        self.static_session = None
        self.dynamic_session = None
        self.scaler_static = None
        self.scaler_dynamic = None
        self._load_models()
    
    def _load_models(self):
        """Carga los modelos ONNX y los scalers."""
        try:
            if os.path.exists(GESTURE_MODEL_PATH):
                self.static_session = ort.InferenceSession(
                    GESTURE_MODEL_PATH,
                    providers=['CPUExecutionProvider']
                )
                print(f"Modelo estatico cargado: {GESTURE_MODEL_PATH}")
            else:
                print(f"ADVERTENCIA: No se encontro {GESTURE_MODEL_PATH}")
            
            if os.path.exists(LSTM_MODEL_PATH):
                self.dynamic_session = ort.InferenceSession(
                    LSTM_MODEL_PATH,
                    providers=['CPUExecutionProvider']
                )
                print(f"Modelo dinamico cargado: {LSTM_MODEL_PATH}")
            else:
                print(f"ADVERTENCIA: No se encontro {LSTM_MODEL_PATH}")
            
            if os.path.exists(SCALER_STATIC_PATH):
                self.scaler_static = joblib.load(SCALER_STATIC_PATH)
                print("Scaler estatico cargado")
            
            if os.path.exists(SCALER_DYNAMIC_PATH):
                self.scaler_dynamic = joblib.load(SCALER_DYNAMIC_PATH)
                print("Scaler dinamico cargado")
        
        except Exception as e:
            print(f"Error cargando modelos: {e}")
    
    def predict_static(self, landmarks: list) -> dict:
        """
        Predice una letra estatica a partir de 63 landmarks.
        
        Args:
            landmarks: Lista de 63 valores (21 puntos x 3 coords)
        
        Returns:
            dict con 'letter', 'confidence'
        """
        if self.static_session is None or self.scaler_static is None:
            return {"error": "Modelo estatico no disponible"}
        
        if len(landmarks) != 63:
            return {"error": f"Se esperaban 63 valores, se recibieron {len(landmarks)}"}
        
        # Normalizar
        X = np.array(landmarks, dtype=np.float32).reshape(1, -1)
        X = self.scaler_static.transform(X).astype(np.float32)
        
        # Inferencia
        input_name = self.static_session.get_inputs()[0].name
        outputs = self.static_session.run(None, {input_name: X})
        
        # Softmax
        logits = outputs[0][0]
        exp = np.exp(logits - np.max(logits))
        probs = exp / exp.sum()
        
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])
        
        return {
            "letter": LETRAS_STATIC[idx],
            "confidence": confidence,
            "mode": "static"
        }
    
    def predict_dynamic(self, sequence: list) -> dict:
        """
        Predice una sena dinamica a partir de una secuencia de 30 frames.
        
        Args:
            sequence: Lista de 30 listas de 63 valores cada una
        
        Returns:
            dict con 'letter', 'confidence'
        """
        if self.dynamic_session is None or self.scaler_dynamic is None:
            return {"error": "Modelo dinamico no disponible"}
        
        if len(sequence) != 30:
            return {"error": f"Se esperaban 30 frames, se recibieron {len(sequence)}"}
        
        seq = np.array(sequence, dtype=np.float32)
        if seq.shape != (30, 63):
            return {"error": f"Forma incorrecta: {seq.shape}, se esperaba (30, 63)"}
        
        # Normalizar cada frame
        flat = seq.reshape(-1, 63)
        flat = self.scaler_dynamic.transform(flat).astype(np.float32)
        seq = flat.reshape(1, 30, 63)
        
        # Inferencia
        input_name = self.dynamic_session.get_inputs()[0].name
        outputs = self.dynamic_session.run(None, {input_name: seq})
        
        # Softmax
        logits = outputs[0][0]
        exp = np.exp(logits - np.max(logits))
        probs = exp / exp.sum()
        
        idx = int(np.argmax(probs))
        confidence = float(probs[idx])
        
        return {
            "letter": SENAS_DYNAMIC[idx],
            "confidence": confidence,
            "mode": "dynamic"
        }


# Instancia singleton
recognition_service = RecognitionService()