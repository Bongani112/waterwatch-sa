from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Query
from sqlalchemy import Date, cast, func, select

from app.api.deps import AdminUser, DbSession
from app.models import Category, Confirmation, Incident, IncidentStatus, Location, User, UserRole
from app.models.enums import CLOSED_STATUSES, VERIFIED_STATUSES
from app.schemas.analytics import AnalyticsOut, AnalyticsTotals, CountItem, DailyPoint

router = APIRouter(prefix="/api/admin", tags=["admin"])

LOCAL_TZ = "Africa/Johannesburg"


@router.get("/users")
def staff_users(db: DbSession, _: AdminUser) -> list[dict]:
    rows = db.scalars(select(User).where(User.role == UserRole.admin).order_by(User.name))
    return [{"user_id": u.user_id, "name": u.name, "email": u.email} for u in rows]


@router.get("/analytics", response_model=AnalyticsOut)
def analytics(
    db: DbSession,
    _: AdminUser,
    days: int = Query(default=30, ge=7, le=365),
    province: str | None = None,
) -> AnalyticsOut:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    def scoped(stmt):
        stmt = stmt.where(Incident.created_at >= since)
        if province:
            stmt = stmt.join(Location, Incident.location_id == Location.location_id).where(
                Location.province == province
            )
        return stmt

    status_rows = db.execute(scoped(select(Incident.status, func.count()).group_by(Incident.status))).all()
    by_status = {s: c for s, c in status_rows}
    total = sum(by_status.values())
    rejected = by_status.get(IncidentStatus.rejected, 0)
    duplicates = by_status.get(IncidentStatus.duplicate, 0)

    avg_seconds = db.scalar(
        scoped(
            select(func.avg(func.extract("epoch", Incident.resolved_at - Incident.created_at))).where(
                Incident.resolved_at.is_not(None)
            )
        )
    )
    confirmations = db.scalar(
        scoped(
            select(func.count(Confirmation.confirmation_id)).join(
                Incident, Confirmation.incident_id == Incident.incident_id
            )
        )
    )

    totals = AnalyticsTotals(
        reported=total - rejected,
        verified=sum(by_status.get(s, 0) for s in VERIFIED_STATUSES),
        resolved=by_status.get(IncidentStatus.resolved, 0),
        open=sum(c for s, c in by_status.items() if s not in CLOSED_STATUSES),
        duplicates=duplicates,
        rejected=rejected,
        community_confirmations=confirmations or 0,
        avg_resolution_hours=round(float(avg_seconds) / 3600, 1) if avg_seconds else None,
    )

    not_rejected = Incident.status != IncidentStatus.rejected
    cat_rows = db.execute(
        scoped(
            select(Category.category_name, func.count())
            .select_from(Incident)
            .join(Category, Incident.category_id == Category.category_id)
            .where(not_rejected)
            .group_by(Category.category_name)
            .order_by(func.count().desc())
        )
    ).all()

    muni_stmt = (
        select(Location.municipality, func.count())
        .select_from(Incident)
        .join(Location, Incident.location_id == Location.location_id)
        .where(Incident.created_at >= since, not_rejected)
        .group_by(Location.municipality)
        .order_by(func.count().desc())
        .limit(10)
    )
    if province:
        muni_stmt = muni_stmt.where(Location.province == province)
    muni_rows = db.execute(muni_stmt).all()

    created_day = cast(func.timezone(LOCAL_TZ, Incident.created_at), Date)
    resolved_day = cast(func.timezone(LOCAL_TZ, Incident.resolved_at), Date)
    reported_daily = dict(
        db.execute(scoped(select(created_day, func.count()).where(not_rejected).group_by(created_day))).all()
    )
    resolved_daily = dict(
        db.execute(
            scoped(select(resolved_day, func.count()).where(Incident.resolved_at.is_not(None)).group_by(resolved_day))
        ).all()
    )
    today = date.today()
    daily = []
    for offset in range(days - 1, -1, -1):
        d = today - timedelta(days=offset)
        daily.append(
            DailyPoint(date=d.isoformat(), reported=reported_daily.get(d, 0), resolved=resolved_daily.get(d, 0))
        )

    return AnalyticsOut(
        totals=totals,
        by_category=[CountItem(label=n, count=c) for n, c in cat_rows],
        by_status=[CountItem(label=s.value, count=by_status.get(s, 0)) for s in IncidentStatus if by_status.get(s)],
        by_municipality=[CountItem(label=n, count=c) for n, c in muni_rows],
        daily=daily,
    )
