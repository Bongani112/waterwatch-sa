# Architecture

```
Browser (React SPA) ──/api──▶ FastAPI ──SQLAlchemy──▶ PostgreSQL + PostGIS
                                  └──▶ upload volume (outside web root)
```

In development Vite proxies `/api` to the backend; in Docker, nginx serves the built SPA and proxies `/api`.

## Data model
`users`, `locations` (PostGIS point + province/municipality/suburb), `categories`, `incidents`, `confirmations`
(unique per incident/user), `incident_updates` (audit trail), `attachments`, `notifications`.

## Status workflow
`submitted → under_review → verified → assigned → in_progress → resolved`. Admins can move forward any number of steps;
`duplicate` and `rejected` close an incident from any open state. Every change writes an `incident_updates` row and
notifies the reporter and residents who confirmed the incident. `resolved_at` drives the average resolution time metric.

## Privacy and safety
- Passwords hashed with bcrypt; JWT access tokens (configurable expiry).
- Public coordinates rounded to ~100 m; reporter identity and exact location only for admins.
- Uploads: type checked by file signature (JPEG/PNG/WebP), size-limited, random file names, stored outside the web root,
  served through an endpoint that applies incident visibility rules.
- Community reports are labelled as unverified until an admin verifies them; the platform makes no water-safety claims.
