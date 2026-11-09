# API reference

Base path: `/api`. Interactive docs are served at `/docs` (Swagger) and `/redoc`.
Authenticated endpoints expect `Authorization: Bearer <token>`.

## Meta
| Method | Path          | Auth | Description |
|--------|---------------|------|-------------|
| GET    | `/health`     | -    | Service and database health |
| GET    | `/categories` | -    | Incident categories |
| GET    | `/meta`       | -    | Provinces, statuses, workflow, upload limits |

## Auth
| Method | Path             | Auth | Description |
|--------|------------------|------|-------------|
| POST   | `/auth/register` | -    | Create a resident account, returns token |
| POST   | `/auth/login`    | -    | Returns token |
| GET    | `/auth/me`       | user | Current user |

## Incidents
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/incidents` | optional | Paginated list. Filters: `category`, `status`, `province`, `municipality`, `q`, `date_from`, `date_to`, `mine`, `lat`/`lng`/`radius_km`, `page`, `page_size` |
| GET    | `/map/incidents` | optional | Lightweight markers (same filters) |
| POST   | `/incidents` | user | Create a report |
| GET    | `/incidents/{id}` | optional | Detail with update history and attachments |
| PATCH  | `/incidents/{id}` | owner/admin | Edit (residents only while `submitted`); admins can set priority/assignee |
| POST   | `/incidents/{id}/confirm` | user | Confirm (once per user, not on own report) |
| DELETE | `/incidents/{id}/confirm` | user | Remove confirmation |
| POST   | `/incidents/{id}/updates` | admin | Change status and/or post a comment; `duplicate_of` required for `duplicate` |
| POST   | `/incidents/{id}/attachments` | owner/admin | Upload a photo (multipart `file`) |
| GET    | `/attachments/{id}` | depends on incident visibility | Download a photo |

Public responses round coordinates to 3 decimals (~100 m) and omit reporter details. Rejected incidents are only visible
to their reporter and admins.

## Notifications
| Method | Path | Auth |
|--------|------|------|
| GET    | `/notifications` | user |
| GET    | `/notifications/unread-count` | user |
| POST   | `/notifications/{id}/read` | user |
| POST   | `/notifications/read-all` | user |

## Admin
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/admin/users?role=admin` | Users (for assignment) |
| GET    | `/admin/analytics?days=30&province=...` | Dashboard metrics |
