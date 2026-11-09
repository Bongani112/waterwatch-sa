from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Select, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Category,
    Confirmation,
    Incident,
    IncidentStatus,
    IncidentUpdate,
    Location,
    Notification,
    User,
    UserRole,
)
from app.models.enums import HIDDEN_STATUSES, allowed_transitions
from app.schemas.incidents import (
    AttachmentOut,
    CategoryOut,
    IncidentDetail,
    IncidentSummary,
    LocationOut,
    MapIncident,
    UpdateOut,
)

PUBLIC_COORD_DECIMALS = 3  # ~100 m; avoids publishing exact home locations


def make_reference(incident: Incident) -> str:
    year = (incident.created_at or datetime.now()).year
    return f"WW-{year}-{incident.incident_id:06d}"


def is_admin(user: User | None) -> bool:
    return user is not None and user.role == UserRole.admin


def can_view(incident: Incident, user: User | None) -> bool:
    if incident.status not in HIDDEN_STATUSES:
        return True
    return is_admin(user) or (user is not None and user.user_id == incident.user_id)


def confirmation_counts(db: Session, incident_ids: list[int]) -> dict[int, int]:
    if not incident_ids:
        return {}
    rows = db.execute(
        select(Confirmation.incident_id, func.count())
        .where(Confirmation.incident_id.in_(incident_ids))
        .group_by(Confirmation.incident_id)
    ).all()
    return {r[0]: r[1] for r in rows}


def confirmed_by(db: Session, incident_ids: list[int], user: User | None) -> set[int]:
    if not incident_ids or user is None:
        return set()
    rows = db.scalars(
        select(Confirmation.incident_id).where(
            Confirmation.incident_id.in_(incident_ids), Confirmation.user_id == user.user_id
        )
    ).all()
    return set(rows)


def _location_out(incident: Incident, user: User | None) -> LocationOut:
    loc = incident.location
    exact = is_admin(user) or (user is not None and user.user_id == incident.user_id)
    lat, lng = loc.latitude, loc.longitude
    if not exact:
        lat, lng = round(lat, PUBLIC_COORD_DECIMALS), round(lng, PUBLIC_COORD_DECIMALS)
    return LocationOut(
        province=loc.province,
        municipality=loc.municipality,
        suburb=loc.suburb,
        latitude=lat,
        longitude=lng,
    )


def to_summary(incident: Incident, user: User | None, counts: dict[int, int], confirmed: set[int]) -> IncidentSummary:
    return IncidentSummary(
        incident_id=incident.incident_id,
        reference=incident.reference or make_reference(incident),
        title=incident.title,
        status=incident.status,
        priority=incident.priority,
        category=CategoryOut.model_validate(incident.category),
        location=_location_out(incident, user),
        confirmation_count=counts.get(incident.incident_id, 0),
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        is_owner=user is not None and user.user_id == incident.user_id,
        has_confirmed=incident.incident_id in confirmed,
    )


def to_detail(db: Session, incident: Incident, user: User | None) -> IncidentDetail:
    ids = [incident.incident_id]
    summary = to_summary(incident, user, confirmation_counts(db, ids), confirmed_by(db, ids, user))
    admin = is_admin(user)
    dup_ref = None
    if incident.duplicate_of:
        dup = db.get(Incident, incident.duplicate_of)
        dup_ref = dup.reference if dup else None
    updates = [
        UpdateOut(
            update_id=u.update_id,
            previous_status=u.previous_status,
            status=u.status,
            comments=u.comments,
            updated_at=u.updated_at,
            # Residents' names are never published; staff updates show the role only to the public.
            updated_by_name=(u.author.name if u.author and admin else None),
            updated_by_role=(u.author.role.value if u.author else None),
        )
        for u in incident.updates
    ]
    attachments = [
        AttachmentOut(
            attachment_id=a.attachment_id,
            url=f"/api/attachments/{a.attachment_id}",
            content_type=a.content_type,
            uploaded_at=a.uploaded_at,
        )
        for a in incident.attachments
    ]
    return IncidentDetail(
        **summary.model_dump(),
        description=incident.description,
        occurred_at=incident.occurred_at,
        resolved_at=incident.resolved_at,
        duplicate_of=incident.duplicate_of,
        duplicate_of_reference=dup_ref,
        assigned_to=incident.assigned_to if admin else None,
        assigned_to_name=(incident.assignee.name if admin and incident.assignee else None),
        reporter_name=incident.reporter.name if admin else None,
        reporter_email=incident.reporter.email if admin else None,
        updates=updates,
        attachments=attachments,
        allowed_transitions=sorted(allowed_transitions(incident.status), key=list(IncidentStatus).index)
        if admin
        else [],
    )


def to_map_item(incident: Incident, counts: dict[int, int]) -> MapIncident:
    loc = incident.location
    return MapIncident(
        incident_id=incident.incident_id,
        reference=incident.reference or make_reference(incident),
        title=incident.title,
        status=incident.status,
        category=incident.category.category_name,
        category_slug=incident.category.slug,
        latitude=round(loc.latitude, PUBLIC_COORD_DECIMALS),
        longitude=round(loc.longitude, PUBLIC_COORD_DECIMALS),
        municipality=loc.municipality,
        suburb=loc.suburb,
        confirmation_count=counts.get(incident.incident_id, 0),
        created_at=incident.created_at,
    )


def filtered_query(
    user: User | None,
    *,
    category_id: int | None = None,
    status: list[IncidentStatus] | None = None,
    province: str | None = None,
    municipality: str | None = None,
    q: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    mine: bool = False,
) -> Select:
    stmt = (
        select(Incident)
        .join(Incident.location)
        .join(Incident.category)
        .options(selectinload(Incident.location), selectinload(Incident.category))
    )
    if mine and user is not None:
        stmt = stmt.where(Incident.user_id == user.user_id)
    elif not is_admin(user):
        stmt = stmt.where(Incident.status.not_in(list(HIDDEN_STATUSES)))
    if category_id:
        stmt = stmt.where(Incident.category_id == category_id)
    if status:
        stmt = stmt.where(Incident.status.in_(status))
    if province:
        stmt = stmt.where(Location.province == province)
    if municipality:
        stmt = stmt.where(Location.municipality.ilike(f"%{municipality}%"))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Incident.title.ilike(like),
                Incident.description.ilike(like),
                Incident.reference.ilike(like),
                Location.suburb.ilike(like),
                Location.municipality.ilike(like),
            )
        )
    if date_from:
        stmt = stmt.where(Incident.created_at >= date_from)
    if date_to:
        stmt = stmt.where(Incident.created_at <= date_to)
    if lat is not None and lng is not None and radius_km:
        point = cast(func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), Geography)
        stmt = stmt.where(func.ST_DWithin(Location.geom, point, radius_km * 1000))
    return stmt


def notify(db: Session, user_ids: set[int], incident: Incident, message: str) -> None:
    for uid in user_ids:
        db.add(Notification(user_id=uid, incident_id=incident.incident_id, message=message))


def followers(db: Session, incident: Incident) -> set[int]:
    """The reporter plus every resident who confirmed the incident."""
    ids = set(db.scalars(select(Confirmation.user_id).where(Confirmation.incident_id == incident.incident_id)))
    ids.add(incident.user_id)
    return ids


def record_update(
    db: Session,
    incident: Incident,
    actor: User,
    new_status: IncidentStatus | None,
    comments: str | None,
) -> IncidentUpdate:
    previous = incident.status
    if new_status is not None and new_status != previous:
        incident.status = new_status
        if new_status == IncidentStatus.resolved:
            incident.resolved_at = func.now()
    update = IncidentUpdate(
        incident_id=incident.incident_id,
        updated_by=actor.user_id,
        previous_status=previous,
        status=incident.status,
        comments=comments,
    )
    db.add(update)
    incident.updated_at = func.now()
    return update


def category_exists(db: Session, category_id: int) -> bool:
    return db.get(Category, category_id) is not None
