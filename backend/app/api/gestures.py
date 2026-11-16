import base64, json, re
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.community import GestureSample
from app.schemas.community import GestureCreate

router = APIRouter(prefix="/api/gestures", tags=["aprendizaje de señas"])
ROOT = Path(__file__).resolve().parents[2] / "storage" / "gestures"
MAX_FRAME_BYTES = 1_500_000

def serialize(row):
    return {"id": str(row.id), "label": row.label, "description": row.description,
      "frame_count": len(json.loads(row.frames_json)), "status": row.status, "created_at": row.created_at}

@router.get("")
def list_samples(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(GestureSample).filter_by(user_id=user.id).order_by(GestureSample.created_at.desc()).limit(300).all()
    return {"items": [serialize(x) for x in rows]}

@router.post("", status_code=201)
def create_sample(payload: GestureCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    clean=[]
    total_bytes = 0
    for frame in payload.frames:
        match = re.fullmatch(r"data:image/(jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)", frame)
        if not match: raise HTTPException(422, "Cada frame debe ser una imagen JPEG o PNG en base64")
        try: raw=base64.b64decode(match.group(2), validate=True)
        except Exception: raise HTTPException(422, "Imagen base64 inválida")
        if len(raw)>MAX_FRAME_BYTES: raise HTTPException(413, "Una captura supera el tamaño permitido")
        total_bytes += len(raw)
        if total_bytes > 10_000_000: raise HTTPException(413, "El conjunto supera 10 MB")
        clean.append(frame)
    row=GestureSample(user_id=user.id, label=payload.label.strip(), description=payload.description.strip(), frames_json=json.dumps(clean), status="pending")
    db.add(row); db.commit(); db.refresh(row)
    return serialize(row)

@router.delete("/{sample_id}", status_code=204)
def delete_sample(sample_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row=db.query(GestureSample).filter_by(id=sample_id,user_id=user.id).first()
    if not row: raise HTTPException(404,"Muestra no encontrada")
    db.delete(row); db.commit()

@router.get("/dataset/export")
def export_dataset(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows=db.query(GestureSample).filter_by(user_id=user.id).all()
    return {"version":1,"items":[{"label":r.label,"description":r.description,"frames":json.loads(r.frames_json),"created_at":r.created_at} for r in rows]}
