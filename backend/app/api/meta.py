from fastapi import APIRouter
from sqlalchemy import select, text

from app.api.deps import DbSession
from app.models import Category, IncidentStatus
from app.models.enums import WORKFLOW
from app.schemas.incidents import SA_PROVINCES, CategoryOut

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health")
def health(db: DbSession) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}


@router.get("/categories", response_model=list[CategoryOut])
def categories(db: DbSession) -> list[Category]:
    return list(db.scalars(select(Category).order_by(Category.category_id)))


@router.get("/meta")
def meta() -> dict:
    return {
        "provinces": SA_PROVINCES,
        "statuses": [s.value for s in IncidentStatus],
        "workflow": [s.value for s in WORKFLOW],
    }
