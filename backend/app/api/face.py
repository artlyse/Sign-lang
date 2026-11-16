"""Registro y verificación facial asociado a la cuenta del usuario.

La plantilla biométrica y la imagen se guardan en la base de datos compartida,
no en localStorage ni en el equipo cliente. InsightFace se carga de forma
perezosa para evitar descargar el modelo durante el arranque de la API.
"""
from __future__ import annotations

import json
import base64
import hashlib
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.community import FaceEnrollment
from app.models.user_profile import UserProfile
from app.config import SECRET_KEY

router = APIRouter(prefix="/api/users/me/face", tags=["perfil facial"])
MAX_SIZE = 5 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp"}


def _cipher():
    from cryptography.fernet import Fernet
    key = base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode("utf-8")).digest())
    return Fernet(key)


def _encrypt(data: bytes) -> bytes:
    return _cipher().encrypt(data)


def _decrypt(data: bytes) -> bytes:
    try:
        return _cipher().decrypt(data)
    except Exception as exc:
        raise HTTPException(500, "No se pudo descifrar el registro facial. Verifica que SECRET_KEY no haya cambiado.") from exc


@lru_cache(maxsize=1)
def _face_analyzer():
    try:
        from insightface.app import FaceAnalysis
        # ONNX Runtime selecciona CUDA si está instalado; CPU queda como respaldo.
        import onnxruntime as ort
        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        model = FaceAnalysis(name="buffalo_l", providers=providers)
        model.prepare(ctx_id=0 if "CUDAExecutionProvider" in ort.get_available_providers() else -1,
                      det_size=(640, 640))
        return model
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=("El reconocimiento facial no está instalado o no pudo cargar el modelo. "
                    "Instala insightface y opencv-python-headless, y reinicia el backend. "
                    f"Detalle: {exc}"),
        ) from exc


def _embedding(data: bytes) -> np.ndarray:
    try:
        import cv2
        image_array = np.frombuffer(data, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(415, "No se pudo leer la imagen enviada.")
        faces = _face_analyzer().get(image)
        if len(faces) != 1:
            raise HTTPException(422, "Debe aparecer un solo rostro, centrado y con buena iluminación.")
        vector = np.asarray(faces[0].normed_embedding, dtype=np.float32)
        norm = float(np.linalg.norm(vector))
        if not norm:
            raise HTTPException(422, "No se pudo obtener una representación facial válida.")
        return vector / norm
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, f"No se pudo procesar el rostro: {exc}") from exc


async def _read_image(image: UploadFile) -> bytes:
    if image.content_type not in ALLOWED:
        raise HTTPException(415, "Formato permitido: JPEG, PNG o WEBP.")
    data = await image.read(MAX_SIZE + 1)
    if len(data) > MAX_SIZE:
        raise HTTPException(413, "La fotografía supera 5 MB.")
    if not data.startswith((b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"RIFF")):
        raise HTTPException(415, "El archivo no parece una imagen válida.")
    return data


@router.get("")
def face_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.get(FaceEnrollment, user.id)
    return {
        "enrolled": bool(row),
        "recognition_ready": bool(row and row.embedding_json),
        "updated_at": row.updated_at if row else None,
        "message": "Rostro registrado y disponible desde la cuenta." if row and row.embedding_json
                   else "Registra o actualiza tu rostro para habilitar la verificación." if row
                   else "Todavía no hay un rostro registrado en esta cuenta.",
    }


@router.put("")
async def save_face(
    consent: bool = Query(False),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not consent:
        raise HTTPException(400, "Se requiere consentimiento explícito para guardar datos biométricos.")
    data = await _read_image(image)
    vector = _embedding(data)
    row = db.get(FaceEnrollment, user.id)
    old_path = Path(row.image_path) if row and row.image_path else None
    if row is None:
        row = FaceEnrollment(user_id=user.id, image_path="")
        db.add(row)
    row.image_data = _encrypt(data)
    row.embedding_json = _encrypt(json.dumps(vector.tolist(), separators=(",", ":")).encode("utf-8")).decode("ascii")
    row.image_path = ""  # La copia compartida vive en la base de datos, no en el disco del servidor.
    db.commit()
    if old_path and old_path.is_file():
        old_path.unlink(missing_ok=True)
    db.refresh(row)
    return {"saved": True, "recognition_ready": True, "updated_at": row.updated_at,
            "message": "Rostro registrado en tu cuenta y disponible en tus otros dispositivos."}


@router.get("/photo")
def get_face_photo(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.get(FaceEnrollment, user.id)
    if not row:
        raise HTTPException(404, "No hay fotografía registrada.")
    if row.image_data:
        return Response(content=_decrypt(row.image_data), media_type="image/jpeg", headers={"Cache-Control": "no-store"})
    old_path = Path(row.image_path) if row.image_path else None
    if old_path and old_path.is_file():
        from fastapi.responses import FileResponse
        return FileResponse(old_path)
    raise HTTPException(404, "La fotografía anterior no está disponible. Vuelve a registrar tu rostro.")


@router.post("/verify")
async def verify_face(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.get(FaceEnrollment, user.id)
    if not row or not row.embedding_json:
        raise HTTPException(409, "Esta cuenta todavía no tiene una plantilla facial verificada. Registra nuevamente tu rostro.")
    candidate = _embedding(await _read_image(image))
    enrolled = np.asarray(json.loads(_decrypt(row.embedding_json.encode("ascii")).decode("utf-8")), dtype=np.float32)
    similarity = float(np.dot(candidate, enrolled) / (np.linalg.norm(candidate) * np.linalg.norm(enrolled) + 1e-12))
    # Umbral conservador inicial; debe calibrarse con pruebas reales de la cámara.
    matched = similarity >= 0.45
    profile = db.get(UserProfile, user.id)
    display_name = (profile.display_name if profile and profile.display_name else user.username)
    return {"verified": matched, "similarity": round(similarity, 4),
            "display_name": display_name if matched else None,
            "message": "Rostro verificado para esta cuenta." if matched else "El rostro no coincide con el registrado."}


@router.delete("", status_code=204)
def delete_face(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.get(FaceEnrollment, user.id)
    if row:
        old_path = Path(row.image_path) if row.image_path else None
        db.delete(row)
        db.commit()
        if old_path and old_path.is_file():
            old_path.unlink(missing_ok=True)
