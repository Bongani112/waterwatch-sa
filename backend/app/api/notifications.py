from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select, update

from app.api.deps import CurrentUser, DbSession
from app.models import Notification
from app.schemas.incidents import NotificationList, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _unread(db: DbSession, user_id: int) -> int:
    return db.scalar(select(func.count()).where(Notification.user_id == user_id, Notification.is_read.is_(False))) or 0


@router.get("", response_model=NotificationList)
def list_notifications(
    db: DbSession, user: CurrentUser, limit: int = Query(default=30, ge=1, le=100)
) -> NotificationList:
    rows = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.user_id)
        .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
        .limit(limit)
    )
    return NotificationList(
        items=[NotificationOut.model_validate(n) for n in rows],
        unread_count=_unread(db, user.user_id),
    )


@router.get("/unread-count")
def unread_count(db: DbSession, user: CurrentUser) -> dict:
    return {"unread_count": _unread(db, user.user_id)}


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: DbSession, user: CurrentUser) -> Notification:
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    n.is_read = True
    db.commit()
    return n


@router.post("/read-all")
def mark_all_read(db: DbSession, user: CurrentUser) -> dict:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return {"unread_count": 0}
