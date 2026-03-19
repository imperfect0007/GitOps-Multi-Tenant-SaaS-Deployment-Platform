# Day 6 — Production Backend (Database + Clean Architecture)

## Goal

Upgrade the Day 5 backend from a working prototype to a production-grade SaaS backend with proper database management, RBAC, pagination, and clean architecture.

```
User → Auth (JWT) → DB → Create Tenant → Store Project → Deploy via GitOps
```

---

## What Changed from Day 5

| Area | Day 5 | Day 6 |
|------|-------|-------|
| DB management | `create_all()` on startup | Alembic migrations (versioned) |
| User model | email, username, password | + role (RBAC), is_active, updated_at |
| Project model | name, image, replicas | + repo_url, updated_at |
| Tenant model | name, namespace, owner | + updated_at |
| List endpoints | Return all results | Pagination (skip/limit) |
| Error handling | Per-route try/catch | Global exception handler middleware |
| Lifecycle | `@app.on_event` (deprecated) | Modern `lifespan` context manager |
| Cleanup | No delete routes | DELETE for tenants and projects |
| Auth | Basic JWT | + is_active check, require_admin helper |
| API version | 0.1.0 | 0.2.0 |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    FastAPI App                        │
│                                                      │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │  Auth   │ │ Tenants  │ │ Projects │ │  Deploy  ││
│  │ Routes  │ │ Routes   │ │ Routes   │ │  Routes  ││
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘│
│       │           │            │             │       │
│  ┌────▼───────────▼────────────▼─────────────▼─────┐│
│  │              Service Layer                       ││
│  │  security.py │ tenants/service │ projects/service││
│  │              │ gitops/service  │ deploy/service  ││
│  └────┬───────────┬────────────┬─────────────┬─────┘│
│       │           │            │             │       │
│  ┌────▼───────────▼────────────▼─────────────▼─────┐│
│  │            Database Layer (SQLAlchemy)            ││
│  │   User │ Tenant │ Project   (via Alembic)        ││
│  └──────────────────┬──────────────────────────────┘│
│                      │                               │
│  ┌──────────────────▼──────────────────────────────┐│
│  │         Infrastructure Layer                     ││
│  │   Kubernetes API │ GitOps Repo │ ArgoCD          ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

---

## Database Schema

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, indexed |
| email | String | unique, indexed, not null |
| username | String | unique, indexed, not null |
| hashed_password | String | not null |
| role | String | not null, default="user" |
| is_active | Boolean | not null, default=true |
| created_at | DateTime(tz) | server default now() |
| updated_at | DateTime(tz) | server default now(), auto-update |

### tenants

| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, indexed |
| name | String | unique, indexed, not null |
| namespace | String | unique, not null |
| owner_id | Integer | FK→users.id, not null |
| created_at | DateTime(tz) | server default now() |
| updated_at | DateTime(tz) | server default now(), auto-update |

### projects

| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, indexed |
| name | String | indexed, not null |
| image | String | not null, default="nginx:1.27-alpine" |
| replicas | Integer | default=2 |
| port | Integer | default=80 |
| repo_url | String | nullable |
| status | String | default="pending" |
| tenant_id | Integer | FK→tenants.id, not null |
| created_at | DateTime(tz) | server default now() |
| updated_at | DateTime(tz) | server default now(), auto-update |

### Relationships

```
User  ──1:N──▶  Tenant  ──1:N──▶  Project
       (owner)           (belongs to)

Cascade: delete user → deletes tenants → deletes projects
```

---

## Alembic Migrations

### Setup

Alembic is configured in `backend/alembic/` with `env.py` wired to load the app's database URL from `Settings` and register all models via `import app.models`.

### Commands

```bash
cd backend

# Check current migration version
alembic current

# Generate new migration after model changes
alembic revision --autogenerate -m "description of change"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

### Initial Migration

The initial migration (`8452b198d891`) creates all 3 tables with:
- Primary keys and foreign key constraints
- Unique indexes on email, username, tenant name, namespace
- `render_as_batch=True` for SQLite compatibility

---

## API Endpoints (14 routes)

### Authentication (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create user (bcrypt hash) |
| POST | `/auth/login` | No | JWT access token |
| GET | `/auth/me` | Yes | Current user profile |

### Tenants (`/tenants`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/tenants/` | Yes | Create tenant + K8s namespace |
| GET | `/tenants/?skip=0&limit=20` | Yes | Paginated tenant list |
| GET | `/tenants/{id}` | Yes | Get specific tenant |
| DELETE | `/tenants/{id}` | Yes | Delete tenant + K8s namespace |

### Projects

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/tenants/{id}/projects` | Yes | Create + deploy project |
| GET | `/tenants/{id}/projects?skip=0&limit=20` | Yes | Paginated project list |
| GET | `/projects/{id}` | Yes | Get specific project |
| DELETE | `/projects/{id}` | Yes | Delete project |

### Deployments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/tenants/{id}/deployments?status_filter=deployed` | Yes | Filtered deployment list |
| GET | `/deployments/{id}/status` | Yes | Live K8s status |

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness check |

---

## RBAC (Role-Based Access Control)

### User Roles

| Role | Permissions |
|------|-------------|
| `user` | Manage own tenants and projects |
| `admin` | All user permissions + admin-only routes |

### Implementation

- `User.role` column stores the role string
- `User.is_active` flag can deactivate accounts without deletion
- `get_current_user()` checks `is_active` before returning
- `require_admin()` dependency rejects non-admin users with 403

---

## Pagination

All list endpoints support pagination via query parameters:

| Parameter | Default | Min | Max |
|-----------|---------|-----|-----|
| `skip` | 0 | 0 | — |
| `limit` | 20 | 1 | 100 |

```bash
# Get first page (20 items)
GET /tenants/?skip=0&limit=20

# Get second page
GET /tenants/?skip=20&limit=20
```

---

## Global Exception Handler

Unhandled exceptions are caught by `global_exception_handler` which:
1. Logs the full traceback with method and path
2. Returns a structured JSON error (no stack traces leaked to clients)

```json
{
  "detail": "Internal server error",
  "type": "SomeExceptionClass"
}
```

---

## PostgreSQL Ready

The backend defaults to SQLite for local development but is fully PostgreSQL-ready:

```bash
# .env file
DATABASE_URL=postgresql://user:password@localhost:5432/gitops_saas
```

The config at `app/core/config.py` auto-detects the driver and adjusts connection arguments (e.g., SQLite's `check_same_thread=False` is only applied for SQLite URLs).

---

## Running

```bash
cd backend

# Apply migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload

# Swagger docs: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

---

## What Was Achieved

- Alembic migration system with versioned schema changes
- RBAC with user roles and account deactivation
- Pagination on all list endpoints
- DELETE endpoints for tenants and projects (with K8s cleanup)
- Global exception handler (no stack traces leaked)
- Modern lifespan management (no deprecated on_event)
- repo_url field for project source tracking
- updated_at timestamps on all models
- Cascade deletes (user → tenants → projects)
- Production-ready architecture: Routes → Services → Models → Infrastructure
