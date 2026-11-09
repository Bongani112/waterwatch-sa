from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import IncidentStatus, Priority

SA_PROVINCES = [
    "Eastern Cape",
    "Free State",
    "Gauteng",
    "KwaZulu-Natal",
    "Limpopo",
    "Mpumalanga",
    "North West",
    "Northern Cape",
    "Western Cape",
]


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    category_name: str
    slug: str


class LocationIn(BaseModel):
    province: str
    municipality: str = Field(min_length=2, max_length=120)
    suburb: str | None = Field(default=None, max_length=120)
    latitude: float = Field(ge=-35.5, le=-21.5)
    longitude: float = Field(ge=16.0, le=33.5)

    @field_validator("province")
    @classmethod
    def valid_province(cls, v: str) -> str:
        if v not in SA_PROVINCES:
            raise ValueError("Unknown province")
        return v


class LocationOut(BaseModel):
    province: str
    municipality: str
    suburb: str | None
    latitude: float
    longitude: float


class IncidentCreate(BaseModel):
    category_id: int
    title: str = Field(min_length=5, max_length=140)
    description: str = Field(min_length=10, max_length=4000)
    occurred_at: datetime | None = None
    location: LocationIn


class IncidentEdit(BaseModel):
    """Residents may edit their own report while it is still `submitted`; admins may set triage fields."""

    title: str | None = Field(default=None, min_length=5, max_length=140)
    description: str | None = Field(default=None, min_length=10, max_length=4000)
    priority: Priority | None = None
    assigned_to: int | None = None


class IncidentUpdateCreate(BaseModel):
    status: IncidentStatus | None = None
    comments: str | None = Field(default=None, max_length=2000)
    duplicate_of: int | None = None
    assigned_to: int | None = None


class UpdateOut(BaseModel):
    update_id: int
    previous_status: IncidentStatus | None
    status: IncidentStatus
    comments: str | None
    updated_at: datetime
    updated_by_name: str | None
    updated_by_role: str | None


class AttachmentOut(BaseModel):
    attachment_id: int
    url: str
    content_type: str
    uploaded_at: datetime


class IncidentSummary(BaseModel):
    incident_id: int
    reference: str
    title: str
    status: IncidentStatus
    priority: Priority
    category: CategoryOut
    location: LocationOut
    confirmation_count: int
    created_at: datetime
    updated_at: datetime
    is_owner: bool = False
    has_confirmed: bool = False


class IncidentDetail(IncidentSummary):
    description: str
    occurred_at: datetime | None
    resolved_at: datetime | None
    duplicate_of: int | None
    duplicate_of_reference: str | None
    assigned_to: int | None
    assigned_to_name: str | None
    reporter_name: str | None = None
    reporter_email: str | None = None
    updates: list[UpdateOut]
    attachments: list[AttachmentOut]
    allowed_transitions: list[IncidentStatus] = []


class IncidentPage(BaseModel):
    items: list[IncidentSummary]
    total: int
    page: int
    page_size: int


class MapIncident(BaseModel):
    incident_id: int
    reference: str
    title: str
    status: IncidentStatus
    category: str
    category_slug: str
    latitude: float
    longitude: float
    municipality: str
    suburb: str | None
    confirmation_count: int
    created_at: datetime


class ConfirmationOut(BaseModel):
    incident_id: int
    confirmation_count: int
    has_confirmed: bool


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notification_id: int
    incident_id: int | None
    message: str
    is_read: bool
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread_count: int
