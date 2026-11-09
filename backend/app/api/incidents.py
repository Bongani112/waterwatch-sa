from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession, OptionalUser
from app.core.config import get_settings
from app.models import (
    Attachment,
    Confirmation,
    Incident,
    IncidentStatus,
    Location,
    User,
    UserRole,
)
from app.models.enums import CLOSED_STATUSES, allowed_transitions
from app.schemas.incidents import (
    ConfirmationOut,
    IncidentCreate,
    IncidentDetail,
    IncidentEdit,
    IncidentPage,
    IncidentUpdateCreate,
    MapIncident,
)
from app.services import incidents as svc
from app.services.storage import detect_image_type, resolve_upload, save_upload

router = APIRouter(prefix="/api", tags=["incidents"])

STATUS_LABELS = {
    IncidentStatus.submitted: "Submitted",
    IncidentStatus.under_review: "Under review",
    IncidentStatus.verified: "Verified",
    IncidentStatus.assigned: "Assigned",
    IncidentStatus.in_progress: "In progress",
    IncidentStatus.resolved: "Resolved",
    IncidentStatus.duplicate: "Duplicate",
    IncidentStatus.rejected: "Rejected",
}


def _load(db: DbSession, incident_id: int) -> Incident:
    incident = db.scalar(
        select(Incident)
        .where(Incident.incident_id == incident_id)
        .options(
            selectinload(Incident.location),
            selectinload(Incident.category),
            selectinload(Incident.reporter),
            selectinload(Incident.assignee),
            selectinload(Incident.attachments),
            selectinload(Incident.updates),
        )
        .execution_options(populate_existing=True)
    )
    if incident is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    return incident


def _load_visible(db: DbSession, incident_id: int, user: User | None) -> Incident:
    incident = _load(db, incident_id)
    if not svc.can_view(incident, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    return incident


@router.get("/incidents", response_model=IncidentPage)
def list_incidents(
    db: DbSession,
    user: OptionalUser,
    category_id: int | None = None,
    status_: list[IncidentStatus] | None = Query(default=None, alias="status"),
    province: str | None = None,
    municipality: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = Query(default=None, gt=0, le=200),
    mine: bool = False,
    sort: Literal["newest", "oldest", "updated"] = "newest",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> IncidentPage:
    if mine and user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to view your reports")
    stmt = svc.filtered_query(
        user,
        category_id=category_id,
        status=status_,
        province=province,
        municipality=municipality,
        q=q,
        date_from=date_from,
        date_to=date_to,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        mine=mine,
    )
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    order = {
        "newest": Incident.created_at.desc(),
        "oldest": Incident.created_at.asc(),
        "updated": Incident.updated_at.desc(),
    }[sort]
    rows = list(db.scalars(stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)))
    ids = [i.incident_id for i in rows]
    counts = svc.confirmation_counts(db, ids)
    confirmed = svc.confirmed_by(db, ids, user)
    return IncidentPage(
        items=[svc.to_summary(i, user, counts, confirmed) for i in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/map/incidents", response_model=list[MapIncident])
def map_incidents(
    db: DbSession,
    user: OptionalUser,
    category_id: int | None = None,
    status_: list[IncidentStatus] | None = Query(default=None, alias="status"),
    province: str | None = None,
    municipality: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = Query(default=1000, ge=1, le=2000),
) -> list[MapIncident]:
    stmt = svc.filtered_query(
        None,  # the map is always the public view
        category_id=category_id,
        status=status_,
        province=province,
        municipality=municipality,
        date_from=date_from,
        date_to=date_to,
    )
    rows = list(db.scalars(stmt.order_by(Incident.created_at.desc()).limit(limit)))
    counts = svc.confirmation_counts(db, [i.incident_id for i in rows])
    return [svc.to_map_item(i, counts) for i in rows]


@router.post("/incidents", response_model=IncidentDetail, status_code=status.HTTP_201_CREATED)
def create_incident(body: IncidentCreate, db: DbSession, user: CurrentUser) -> IncidentDetail:
    if not svc.category_exists(db, body.category_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown category")
    loc = body.location
    location = Location(
        province=loc.province,
        municipality=loc.municipality.strip(),
        suburb=(loc.suburb or "").strip() or None,
        latitude=loc.latitude,
        longitude=loc.longitude,
        geom=f"SRID=4326;POINT({loc.longitude} {loc.latitude})",
    )
    db.add(location)
    db.flush()
    incident = Incident(
        user_id=user.user_id,
        location_id=location.location_id,
        category_id=body.category_id,
        title=body.title.strip(),
        description=body.description.strip(),
        occurred_at=body.occurred_at,
        status=IncidentStatus.submitted,
    )
    db.add(incident)
    db.flush()
    db.refresh(incident)
    incident.reference = svc.make_reference(incident)
    svc.record_update(db, incident, user, None, "Report submitted by resident.")
    db.commit()
    return svc.to_detail(db, _load(db, incident.incident_id), user)


@router.get("/incidents/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: int, db: DbSession, user: OptionalUser) -> IncidentDetail:
    return svc.to_detail(db, _load_visible(db, incident_id, user), user)


@router.patch("/incidents/{incident_id}", response_model=IncidentDetail)
def edit_incident(incident_id: int, body: IncidentEdit, db: DbSession, user: CurrentUser) -> IncidentDetail:
    incident = _load_visible(db, incident_id, user)
    admin = svc.is_admin(user)
    fields = body.model_dump(exclude_unset=True)
    if not admin:
        if incident.user_id != user.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own reports")
        if set(fields) - {"title", "description"}:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only administrators can set triage fields")
        if incident.status != IncidentStatus.submitted:
            raise HTTPException(status.HTTP_409_CONFLICT, "Reports can only be edited before they are reviewed")
    if "assigned_to" in fields and fields["assigned_to"] is not None:
        _require_staff(db, fields["assigned_to"])
    for key, value in fields.items():
        if key in {"title", "description"} and value is not None:
            value = value.strip()
        setattr(incident, key, value)
    incident.updated_at = func.now()
    db.commit()
    return svc.to_detail(db, _load(db, incident_id), user)


def _require_staff(db: DbSession, user_id: int) -> User:
    staff = db.get(User, user_id)
    if staff is None or staff.role != UserRole.admin:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Assignee must be an administrator")
    return staff


@router.post("/incidents/{incident_id}/confirm", response_model=ConfirmationOut)
def confirm_incident(incident_id: int, db: DbSession, user: CurrentUser) -> ConfirmationOut:
    incident = _load_visible(db, incident_id, user)
    if incident.user_id == user.user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You reported this incident")
    if incident.status in CLOSED_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This incident is closed")
    db.add(Confirmation(incident_id=incident_id, user_id=user.user_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already confirmed this incident") from None
    count = svc.confirmation_counts(db, [incident_id]).get(incident_id, 0)
    return ConfirmationOut(incident_id=incident_id, confirmation_count=count, has_confirmed=True)


@router.delete("/incidents/{incident_id}/confirm", response_model=ConfirmationOut)
def unconfirm_incident(incident_id: int, db: DbSession, user: CurrentUser) -> ConfirmationOut:
    _load_visible(db, incident_id, user)
    conf = db.scalar(
        select(Confirmation).where(Confirmation.incident_id == incident_id, Confirmation.user_id == user.user_id)
    )
    if conf is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You have not confirmed this incident")
    db.delete(conf)
    db.commit()
    count = svc.confirmation_counts(db, [incident_id]).get(incident_id, 0)
    return ConfirmationOut(incident_id=incident_id, confirmation_count=count, has_confirmed=False)


@router.post(
    "/incidents/{incident_id}/updates",
    response_model=IncidentDetail,
    status_code=status.HTTP_201_CREATED,
)
def add_update(incident_id: int, body: IncidentUpdateCreate, db: DbSession, user: CurrentUser) -> IncidentDetail:
    if not svc.is_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator access required")
    incident = _load(db, incident_id)
    new_status = body.status if body.status != incident.status else None
    comments = (body.comments or "").strip() or None

    if new_status is None and comments is None and body.assigned_to is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide a status change or a comment")
    if new_status is not None and new_status not in allowed_transitions(incident.status):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot move from {STATUS_LABELS[incident.status]} to {STATUS_LABELS[new_status]}",
        )

    assignee = None
    if body.assigned_to is not None:
        assignee = _require_staff(db, body.assigned_to)
        incident.assigned_to = assignee.user_id
    if new_status == IncidentStatus.assigned and incident.assigned_to is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose an assignee")
    if new_status == IncidentStatus.duplicate:
        if body.duplicate_of is None or body.duplicate_of == incident_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide the original incident for a duplicate")
        original = db.get(Incident, body.duplicate_of)
        if original is None or original.status in {IncidentStatus.duplicate, IncidentStatus.rejected}:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Original incident is not valid")
        incident.duplicate_of = original.incident_id
        if comments is None:
            comments = f"Marked as a duplicate of {original.reference}."

    svc.record_update(db, incident, user, new_status, comments)

    ref = incident.reference
    if new_status is not None:
        message = f"{ref} is now {STATUS_LABELS[new_status]}."
    else:
        message = f"New update on {ref}."
    if comments:
        message = f"{message} {comments}"[:500]
    svc.notify(db, svc.followers(db, incident) - {user.user_id}, incident, message)
    if assignee is not None and assignee.user_id != user.user_id:
        svc.notify(db, {assignee.user_id}, incident, f"{ref} has been assigned to you.")
    db.commit()
    return svc.to_detail(db, _load(db, incident_id), user)


@router.post(
    "/incidents/{incident_id}/attachments",
    response_model=IncidentDetail,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(incident_id: int, file: UploadFile, db: DbSession, user: CurrentUser) -> IncidentDetail:
    settings = get_settings()
    incident = _load_visible(db, incident_id, user)
    if incident.user_id != user.user_id and not svc.is_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the reporter can add photos")
    if incident.status in CLOSED_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This incident is closed")
    if len(incident.attachments) >= settings.max_attachments_per_incident:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"A report can have at most {settings.max_attachments_per_incident} photos",
        )
    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"Photos must be under {settings.max_upload_mb} MB"
        )
    detected = detect_image_type(data)
    if detected is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG or WebP images are allowed")
    content_type, ext = detected
    name = save_upload(data, ext)
    db.add(Attachment(incident_id=incident_id, file_url=name, content_type=content_type, size_bytes=len(data)))
    db.commit()
    return svc.to_detail(db, _load(db, incident_id), user)


@router.get("/attachments/{attachment_id}")
def get_attachment(attachment_id: int, db: DbSession, user: OptionalUser) -> FileResponse:
    attachment = db.get(Attachment, attachment_id)
    if attachment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    _load_visible(db, attachment.incident_id, user)
    path = resolve_upload(attachment.file_url)
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File missing")
    return FileResponse(path, media_type=attachment.content_type)
