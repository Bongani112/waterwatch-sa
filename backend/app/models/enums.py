from enum import Enum


class UserRole(str, Enum):
    resident = "resident"
    admin = "admin"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentStatus(str, Enum):
    submitted = "submitted"
    under_review = "under_review"
    verified = "verified"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    duplicate = "duplicate"
    rejected = "rejected"


WORKFLOW: list[IncidentStatus] = [
    IncidentStatus.submitted,
    IncidentStatus.under_review,
    IncidentStatus.verified,
    IncidentStatus.assigned,
    IncidentStatus.in_progress,
    IncidentStatus.resolved,
]
CLOSED_STATUSES = {IncidentStatus.resolved, IncidentStatus.duplicate, IncidentStatus.rejected}
HIDDEN_STATUSES = {IncidentStatus.rejected}
VERIFIED_STATUSES = {
    IncidentStatus.verified,
    IncidentStatus.assigned,
    IncidentStatus.in_progress,
    IncidentStatus.resolved,
}


def allowed_transitions(current: IncidentStatus) -> set[IncidentStatus]:
    """Forward-only workflow; open incidents may also be closed as duplicate or rejected."""
    if current in CLOSED_STATUSES:
        return set()
    idx = WORKFLOW.index(current)
    return set(WORKFLOW[idx + 1 :]) | {IncidentStatus.duplicate, IncidentStatus.rejected}
