# WaterWatch SA

A community platform for reporting and tracking water outages and water-infrastructure problems in South Africa.
Residents report incidents on a map, confirm reports from neighbours, and follow status updates; administrators review,
verify, and resolve reports and see analytics.

> WaterWatch SA is an independent civic-information tool. It does **not** replace municipal reporting channels or
> emergency services, and it does not certify water quality or safety. Community reports are clearly labelled as such.

## Features (MVP)

- Resident registration and login (JWT, bcrypt-hashed passwords), resident/admin roles
- Guided 4-step report form: category, details, map pin or GPS location, optional photos (JPEG/PNG/WebP, 5 MB, max 3)
- Nearby-duplicate check while reporting, so residents can confirm an existing report instead of creating a new one
- Public map (Leaflet + OpenStreetMap) and searchable list with filters by category, status, province, municipality, date
- Public coordinates are rounded to ~100 m; exact locations and reporter details are visible only to admins
- One confirmation per resident per incident (enforced by a database constraint)
- Controlled workflow: Submitted → Under review → Verified → Assigned → In progress → Resolved, plus Duplicate / Rejected,
  with a timestamped audit trail of every change
- Admin review queue, priority, assignment, duplicate linking, public update comments
- In-app notifications for reporters and residents who confirmed an incident
- Analytics dashboard: reported vs verified vs resolved, by category / status / municipality, average resolution time

AI classification, SMS/email notifications, the municipal-representative role, and predictive analytics are later phases.

## Stack

| Layer    | Tech                                                   |
|----------|--------------------------------------------------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, Leaflet, Recharts |
| Backend  | Python, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, PyJWT, bcrypt |
| Database | PostgreSQL 16 + PostGIS 3.4                            |
| Tooling  | Pytest, Ruff, ESLint, Docker Compose, GitHub Actions   |

## Quick start (Docker)

```bash
cp .env.example .env          # then set JWT_SECRET and ADMIN_PASSWORD
docker compose up --build
docker compose exec backend python -m app.seed --demo   # optional demo data
```

- App: http://localhost:5173
- API docs (Swagger): http://localhost:8000/docs

## Local development

Requirements: Python 3.10+, Node 20+, Docker (for PostGIS).

```bash
cp .env.example .env
docker compose up -d db

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env .env
alembic upgrade head
python -m app.seed --demo        # categories, admin from ADMIN_EMAIL/ADMIN_PASSWORD, demo incidents
uvicorn app.main:app --reload    # http://localhost:8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                      # http://localhost:5173, proxies /api to the backend
```

Demo seed creates residents `resident1@example.com` … `resident5@example.com` (password `password123`) and ~36 incidents
across Gauteng, Western Cape, KwaZulu-Natal and Eastern Cape. Do not run `--demo` in production.

## Tests and checks

```bash
cd backend && ruff check . && pytest      # uses a separate waterwatch_test database
cd frontend && npm run lint && npm run build
```

CI (`.github/workflows/ci.yml`) runs the same checks plus a Docker build on every push and pull request.

## Project layout

```
backend/
  app/api/        FastAPI routers (auth, incidents, notifications, admin, meta)
  app/core/       settings and security (JWT, hashing)
  app/models/     SQLAlchemy models and status workflow
  app/schemas/    Pydantic request/response models
  app/services/   incident logic, privacy rounding, notifications, file storage
  alembic/        database migrations
  tests/          pytest API tests
frontend/
  src/pages/      routed pages (home, incidents, report, detail, admin queue/analytics, ...)
  src/components/ map, filters, timeline, admin panel, layout
  src/services/   typed API client
docs/             API and architecture notes
```

See [docs/API.md](docs/API.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
