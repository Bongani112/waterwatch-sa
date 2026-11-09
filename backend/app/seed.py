"""Seed reference data.

python -m app.seed            # categories + admin from ADMIN_EMAIL / ADMIN_PASSWORD
python -m app.seed --demo     # also creates demo residents and sample incidents
"""

import argparse
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import get_settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models import (
    Category,
    Confirmation,
    Incident,
    IncidentStatus,
    IncidentUpdate,
    Location,
    Priority,
    User,
    UserRole,
)
from app.models.enums import WORKFLOW

CATEGORIES = [
    ("Water outage", "water-outage"),
    ("Burst pipe", "burst-pipe"),
    ("Low pressure", "low-pressure"),
    ("Suspected water-quality concern", "water-quality"),
    ("Damaged meter", "damaged-meter"),
    ("Sewage-related issue", "sewage"),
]

DEMO_PLACES = [
    ("Gauteng", "City of Johannesburg", "Soweto", -26.2485, 27.8540),
    ("Gauteng", "City of Johannesburg", "Randburg", -26.0936, 28.0064),
    ("Gauteng", "City of Johannesburg", "Melville", -26.1756, 28.0080),
    ("Gauteng", "City of Tshwane", "Hatfield", -25.7487, 28.2380),
    ("Gauteng", "City of Tshwane", "Mamelodi", -25.7167, 28.3947),
    ("Gauteng", "City of Ekurhuleni", "Benoni", -26.1885, 28.3208),
    ("Western Cape", "City of Cape Town", "Khayelitsha", -34.0400, 18.6774),
    ("Western Cape", "City of Cape Town", "Bellville", -33.9022, 18.6290),
    ("KwaZulu-Natal", "eThekwini", "Umlazi", -29.9700, 30.8833),
    ("KwaZulu-Natal", "eThekwini", "Durban North", -29.7900, 31.0360),
    ("Eastern Cape", "Nelson Mandela Bay", "Gqeberha Central", -33.9608, 25.6022),
    ("Free State", "Mangaung", "Bloemfontein", -29.0852, 26.1596),
]

DEMO_TEXT = {
    "water-outage": (
        "No water since this morning",
        "Taps have been dry across the street since early morning. Neighbours report the same.",
    ),
    "burst-pipe": (
        "Burst pipe flooding the road",
        "Water is gushing from a pipe on the corner and flowing down the road.",
    ),
    "low-pressure": ("Very low water pressure", "Pressure has been very low for two days; upstairs taps barely run."),
    "water-quality": (
        "Brown water from taps",
        "Tap water has a brown colour and odd smell. Not confirmed by any test.",
    ),
    "damaged-meter": ("Damaged water meter leaking", "The meter box cover is broken and the meter is leaking."),
    "sewage": ("Sewage overflow near school", "A manhole is overflowing next to the primary school entrance."),
}


def seed_reference(db: Session) -> None:
    existing = set(db.scalars(select(Category.slug)))
    for name, slug in CATEGORIES:
        if slug not in existing:
            db.add(Category(category_name=name, slug=slug))
    settings = get_settings()
    if settings.admin_email and settings.admin_password:
        email = settings.admin_email.lower()
        if not db.scalar(select(User).where(func.lower(User.email) == email)):
            db.add(
                User(
                    name=settings.admin_name,
                    email=email,
                    password_hash=hash_password(settings.admin_password),
                    role=UserRole.admin,
                )
            )
    db.commit()


def seed_demo(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(Incident)):
        print("Incidents already exist; skipping demo data.")
        return
    rng = random.Random(42)
    admin = db.scalar(select(User).where(User.role == UserRole.admin))
    residents = []
    for i in range(1, 6):
        email = f"resident{i}@example.com"
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(name=f"Demo Resident {i}", email=email, password_hash=hash_password("password123"))
            db.add(user)
        residents.append(user)
    db.flush()
    categories = list(db.scalars(select(Category)))
    now = datetime.now(timezone.utc)
    for _ in range(36):
        province, muni, suburb, lat, lng = rng.choice(DEMO_PLACES)
        lat += rng.uniform(-0.01, 0.01)
        lng += rng.uniform(-0.01, 0.01)
        cat = rng.choice(categories)
        title, desc = DEMO_TEXT[cat.slug]
        created = now - timedelta(days=rng.randint(0, 28), hours=rng.randint(0, 23))
        reporter = rng.choice(residents)
        loc = Location(
            province=province,
            municipality=muni,
            suburb=suburb,
            latitude=lat,
            longitude=lng,
            geom=f"SRID=4326;POINT({lng} {lat})",
        )
        db.add(loc)
        db.flush()
        steps = rng.choice([0, 0, 1, 2, 3, 4, 5, 5])
        status = WORKFLOW[steps]
        inc = Incident(
            user_id=reporter.user_id,
            location_id=loc.location_id,
            category_id=cat.category_id,
            title=title,
            description=desc,
            status=status,
            priority=rng.choice(list(Priority)),
            created_at=created,
            updated_at=created,
            assigned_to=admin.user_id if admin and steps >= 3 else None,
        )
        db.add(inc)
        db.flush()
        inc.reference = f"WW-{created.year}-{inc.incident_id:06d}"
        db.add(
            IncidentUpdate(
                incident_id=inc.incident_id,
                updated_by=reporter.user_id,
                previous_status=IncidentStatus.submitted,
                status=IncidentStatus.submitted,
                comments="Report submitted by resident.",
                updated_at=created,
            )
        )
        t = created
        for i in range(1, steps + 1):
            t = t + timedelta(hours=rng.randint(2, 30))
            if t > now:
                t = now
            db.add(
                IncidentUpdate(
                    incident_id=inc.incident_id,
                    updated_by=admin.user_id if admin else None,
                    previous_status=WORKFLOW[i - 1],
                    status=WORKFLOW[i],
                    comments=None,
                    updated_at=t,
                )
            )
        inc.updated_at = t
        flag_modified(inc, "updated_at")  # otherwise onupdate=now() wins when t is unchanged
        if status == IncidentStatus.resolved:
            inc.resolved_at = t
        for other in rng.sample(residents, rng.randint(0, 3)):
            if other.user_id != reporter.user_id:
                db.add(
                    Confirmation(
                        incident_id=inc.incident_id, user_id=other.user_id, confirmed_at=created + timedelta(hours=1)
                    )
                )
    db.commit()
    print("Demo data created. Residents: resident1..5@example.com / password123")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()
    with SessionLocal() as db:
        seed_reference(db)
        if args.demo:
            seed_demo(db)
    print("Seed complete.")


if __name__ == "__main__":
    main()
