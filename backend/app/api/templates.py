import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.models.community import PhraseTemplate
from app.schemas.community import TemplateCreate

router = APIRouter(prefix="/api/templates", tags=["plantillas"])

def serialize(row, owner="Comunidad", author=None):
    return {"id": str(row.id), "name": row.name, "category": row.category,
      "description": row.description, "phrases": json.loads(row.phrases_json),
      "triggers": json.loads(row.triggers_json), "owner": owner,
      "author": author or ("Sistema" if row.owner_id is None else "Usuario"),
      "shared": row.is_public, "updatedAt": row.updated_at}


def _authors(db: Session, rows) -> dict:
    """Nombre visible (o usuario) de quien creó cada plantilla."""
    from app.models.user_profile import UserProfile
    ids = {r.owner_id for r in rows if r.owner_id is not None}
    if not ids:
        return {}
    names = {u.id: u.username for u in db.query(User).filter(User.id.in_(ids))}
    for p in db.query(UserProfile).filter(UserProfile.user_id.in_(ids)):
        if p.display_name:
            names[p.user_id] = p.display_name
    return names

@router.get("")
def list_templates(scope: str = Query("all", pattern="^(all|mine|shared)$"), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(PhraseTemplate)
    if scope == "mine": q = q.filter(PhraseTemplate.owner_id == user.id)
    elif scope == "shared": q = q.filter(PhraseTemplate.is_public.is_(True))
    else: q = q.filter((PhraseTemplate.owner_id == user.id) | (PhraseTemplate.is_public.is_(True)))
    rows = q.order_by(PhraseTemplate.updated_at.desc()).limit(250).all()
    authors = _authors(db, rows)
    return {"items": [serialize(r, "Mi cuenta" if r.owner_id == user.id else "Comunidad",
                                authors.get(r.owner_id)) for r in rows]}

@router.post("", status_code=201)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = PhraseTemplate(owner_id=user.id, name=payload.name.strip(), category=payload.category,
        description=payload.description.strip(), phrases_json=json.dumps([x.strip() for x in payload.phrases if x.strip()], ensure_ascii=False),
        triggers_json=json.dumps([x.strip().lower() for x in payload.triggers if x.strip()], ensure_ascii=False), is_public=payload.shared)
    if not json.loads(row.phrases_json): raise HTTPException(422, "La plantilla requiere al menos una frase")
    db.add(row); db.commit(); db.refresh(row)
    return serialize(row, "Mi cuenta", _authors(db, [row]).get(row.owner_id))

@router.put("/{template_id}")
def update_template(template_id: int, payload: TemplateCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(PhraseTemplate).filter_by(id=template_id, owner_id=user.id).first()
    if not row: raise HTTPException(404, "Plantilla no encontrada")
    row.name=payload.name.strip(); row.category=payload.category; row.description=payload.description.strip()
    row.phrases_json=json.dumps([x.strip() for x in payload.phrases if x.strip()], ensure_ascii=False)
    row.triggers_json=json.dumps([x.strip().lower() for x in payload.triggers if x.strip()], ensure_ascii=False); row.is_public=payload.shared
    db.commit(); db.refresh(row); return serialize(row, "Mi cuenta", _authors(db, [row]).get(row.owner_id))

@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(PhraseTemplate).filter_by(id=template_id, owner_id=user.id).first()
    if not row: raise HTTPException(404, "Plantilla no encontrada")
    db.delete(row); db.commit()
