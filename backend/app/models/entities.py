from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import IncidentStatus, Priority, UserRole


def _enum(e):
    return Enum(e, name=e.__name__.lower(), values_callable=lambda x: [m.value for m in x])


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(_enum(UserRole), default=UserRole.resident)
    province: Mapped[str | None] = mapped_column(String(80))
    municipality: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Location(Base):
    __tablename__ = "locations"

    location_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    province: Mapped[str] = mapped_column(String(80), index=True)
    municipality: Mapped[str] = mapped_column(String(120), index=True)
    suburb: Mapped[str | None] = mapped_column(String(120))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    geom = mapped_column(Geography(geometry_type="POINT", srid=4326, spatial_index=True))


class Category(Base):
    __tablename__ = "categories"

    category_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_name: Mapped[str] = mapped_column(String(80), unique=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)


class Incident(Base):
    __tablename__ = "incidents"

    incident_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.location_id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.category_id"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[IncidentStatus] = mapped_column(_enum(IncidentStatus), default=IncidentStatus.submitted, index=True)
    priority: Mapped[Priority] = mapped_column(_enum(Priority), default=Priority.medium)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    duplicate_of: Mapped[int | None] = mapped_column(ForeignKey("incidents.incident_id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    reporter: Mapped[User] = relationship(foreign_keys=[user_id])
    assignee: Mapped[User | None] = relationship(foreign_keys=[assigned_to])
    location: Mapped[Location] = relationship()
    category: Mapped[Category] = relationship()
    updates: Mapped[list["IncidentUpdate"]] = relationship(
        back_populates="incident", order_by="IncidentUpdate.updated_at", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["Attachment"]] = relationship(back_populates="incident", cascade="all, delete-orphan")
    confirmations: Mapped[list["Confirmation"]] = relationship(back_populates="incident", cascade="all, delete-orphan")


class Confirmation(Base):
    __tablename__ = "confirmations"
    __table_args__ = (UniqueConstraint("incident_id", "user_id", name="uq_confirmation_user_incident"),)

    confirmation_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.incident_id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    incident: Mapped[Incident] = relationship(back_populates="confirmations")


class IncidentUpdate(Base):
    __tablename__ = "incident_updates"

    update_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.incident_id", ondelete="CASCADE"), index=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"))
    previous_status: Mapped[IncidentStatus | None] = mapped_column(_enum(IncidentStatus))
    status: Mapped[IncidentStatus] = mapped_column(_enum(IncidentStatus))
    comments: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    incident: Mapped[Incident] = relationship(back_populates="updates")
    author: Mapped[User | None] = relationship()


class Attachment(Base):
    __tablename__ = "attachments"

    attachment_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.incident_id", ondelete="CASCADE"), index=True)
    file_url: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    incident: Mapped[Incident] = relationship(back_populates="attachments")


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    incident_id: Mapped[int | None] = mapped_column(ForeignKey("incidents.incident_id", ondelete="CASCADE"))
    message: Mapped[str] = mapped_column(String(500))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
