# Day 5 — FastAPI Backend (Brains of the Platform)

## Goal

Build the core backend that turns the platform from a DevOps setup into a real SaaS product. The full flow:

```
User → API → Create Tenant → Deploy App (GitOps triggered) → ArgoCD syncs to cluster
```

---

## Architecture

```
                         ┌───────────────┐
                         │   Client /    │
                         │   Dashboard   │
                         └───────┬───────┘
                                 │ HTTP
                         ┌───────▼───────┐
                         │   FastAPI     │
                         │   Backend     │
                         └──┬────┬────┬──┘
                            │    │    │
              ┌─────────────┘    │    └─────────────┐
              ▼                  ▼                  ▼
     ┌────────────────┐ ┌───────────────┐ ┌────────────────┐
     │  SQLite / DB   │ │  Kubernetes   │ │  GitOps Repo   │
     │  (users,       │ │  API          │ │  (manifests)   │
     │   tenants,     │ │  (namespaces, │ │                │
     │   projects)    │ │   quotas)     │ │                │
     └────────────────┘ └───────────────┘ └───────┬────────┘
                                                   │ git push
                                          ┌────────▼────────┐
                                          │    ArgoCD       │
                                          │    (auto-sync)  │
                                          └─────────────────┘
```

---

## Backend Folder Structure

```
backend/
├── Dockerfile
├── requirements.txt
└── app/
    ├── main.py                  # FastAPI app entry point
    ├── __init__.py
    ├── core/
    │   ├── config.py            # Settings (DB URL, JWT secret, GitOps paths)
    │   ├── database.py          # SQLAlchemy engine, session, Base
    │   └── security.py          # Password hashing, JWT tokens, auth dependency
    ├── models/
    │   ├── __init__.py          # Registers all models for table creation
    │   ├── user.py              # User model (email, username, hashed_password)
    │   ├── tenant.py            # Tenant model (name, namespace, owner_id)
    │   └── project.py           # Project model (name, image, replicas, status)
    ├── schemas/
    │   ├── auth.py              # UserRegister, UserLogin, TokenResponse
    │   ├── tenant.py            # TenantCreate, TenantResponse
    │   └── project.py           # ProjectCreate, ProjectResponse
    ├── auth/
    │   └── routes.py            # POST /register, POST /login, GET /me
    ├── tenants/
    │   ├── routes.py            # POST/GET /tenants
    │   └── service.py           # K8s namespace + quota + limits + network policy
    ├── projects/
    │   ├── routes.py            # POST/GET /tenants/{id}/projects
    │   └── service.py           # Full deploy pipeline (manifests → gitops → ArgoCD)
    ├── deployments/
    │   ├── routes.py            # GET deployment status from K8s
    │   └── service.py           # Query K8s API for live deployment state
    └── gitops/
        ├── service.py           # Clone/write/commit/push to gitops repo
        └── manifests.py         # Generate Deployment, Service, ArgoCD Application YAML
```

---

## API Endpoints

### Authentication (`/auth`)

| Method | Path              | Auth | Description              |
|--------|-------------------|------|--------------------------|
| POST   | `/auth/register`  | No   | Create a new user        |
| POST   | `/auth/login`     | No   | Get JWT access token     |
| GET    | `/auth/me`        | Yes  | Get current user profile |

### Tenants (`/tenants`)

| Method | Path               | Auth | Description                      |
|--------|--------------------|------|----------------------------------|
| POST   | `/tenants/`        | Yes  | Create tenant (K8s namespace)    |
| GET    | `/tenants/`        | Yes  | List user's tenants              |
| GET    | `/tenants/{id}`    | Yes  | Get specific tenant              |

### Projects (`/tenants/{id}/projects`)

| Method | Path                              | Auth | Description                    |
|--------|-----------------------------------|------|--------------------------------|
| POST   | `/tenants/{id}/projects`          | Yes  | Create project + deploy        |
| GET    | `/tenants/{id}/projects`          | Yes  | List projects in tenant        |
| GET    | `/projects/{id}`                  | Yes  | Get specific project           |

### Deployments

| Method | Path                              | Auth | Description                         |
|--------|-----------------------------------|------|-------------------------------------|
| GET    | `/tenants/{id}/deployments`       | Yes  | List deployments (filterable)       |
| GET    | `/deployments/{id}/status`        | Yes  | Live K8s deployment status          |

### Health

| Method | Path       | Auth | Description     |
|--------|------------|------|-----------------|
| GET    | `/health`  | No   | Liveness check  |

---

## What Happens When a User Creates a Tenant

```
1. POST /tenants/ { "name": "acme-corp" }
2. Backend sanitizes name → "tenant-acme-corp"
3. Kubernetes Python client creates:
   a. Namespace "tenant-acme-corp"
   b. ResourceQuota (5 pods, 2/4 CPU, 2Gi/4Gi memory)
   c. LimitRange (200m-500m CPU, 256Mi-512Mi memory per container)
   d. NetworkPolicy (tenant isolation + DNS egress)
4. Tenant record saved to database
5. Returns tenant object with namespace
```

---

## What Happens When a User Creates a Project

```
1. POST /tenants/1/projects { "name": "web-app", "image": "nginx:1.27-alpine" }
2. Backend generates Kubernetes manifests:
   a. Deployment (with resource requests/limits)
   b. Service (ClusterIP)
3. Manifests written to gitops-repo/tenants/tenant-acme-corp/web-app/
4. Git commit + push to remote
5. ArgoCD Application created via Kubernetes API (auto-sync enabled)
6. ArgoCD detects the new manifests and deploys to cluster
7. Project status updated to "deployed" in database
```

---

## Key Implementation Details

### Authentication
- **Password hashing**: bcrypt via passlib
- **JWT tokens**: python-jose with HS256 algorithm
- **Token endpoint**: OAuth2-compatible `/auth/login`
- **Auth dependency**: `get_current_user` decodes JWT, loads user from DB

### Tenant Isolation (Kubernetes Python Client)
- No `os.system` calls — uses the official `kubernetes` Python client
- Namespace labels: `platform=gitops-saas`, `tenant=<namespace>`, `managed-by=platform-api`
- ResourceQuota prevents resource exhaustion
- NetworkPolicy blocks cross-tenant communication

### GitOps Integration (GitPython)
- No `os.system` calls — uses `gitpython` for all git operations
- Clones gitops repo on first use, reuses local clone after
- Atomic: write files → stage → commit → push
- Supports `remove_project` for cleanup

### Manifest Generation
- Uses `pyyaml` for proper YAML serialization
- Generates complete, production-ready Kubernetes manifests
- Every container gets resource requests and limits
- Labels ensure consistent pod selection

---

## Running the Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload

# Server starts at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

---

## Testing the Flow

```bash
# 1. Register a user
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","username":"admin","password":"secret123"}'

# 2. Login to get token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret123"}' | jq -r .access_token)

# 3. Create a tenant
curl -X POST http://localhost:8000/tenants/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"acme-corp"}'

# 4. Create a project (triggers GitOps deployment)
curl -X POST http://localhost:8000/tenants/1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"web-app","image":"nginx:1.27-alpine","replicas":2,"port":80}'

# 5. Check deployment status
curl http://localhost:8000/deployments/1/status \
  -H "Authorization: Bearer $TOKEN"
```

---

## Dependencies

| Package              | Purpose                                     |
|----------------------|---------------------------------------------|
| fastapi              | Web framework                               |
| uvicorn              | ASGI server                                 |
| sqlalchemy           | ORM for database access                     |
| pydantic-settings    | Configuration management                    |
| python-jose          | JWT token encoding/decoding                 |
| passlib[bcrypt]      | Password hashing                            |
| python-multipart     | Form data parsing (OAuth2 login)            |
| gitpython            | Git operations (clone, commit, push)        |
| kubernetes           | Kubernetes API client                       |
| pyyaml               | YAML manifest generation                    |
| httpx                | HTTP client for testing                     |
| psycopg2-binary      | PostgreSQL driver (for production)          |
| alembic              | Database migrations                         |

---

## What Was Achieved

- Full backend structure with clean separation of concerns
- JWT authentication (register, login, protected routes)
- Tenant creation with real Kubernetes namespace isolation
- Project deployment pipeline (manifests → gitops → ArgoCD)
- Deployment status tracking from live Kubernetes cluster
- Database persistence for users, tenants, and projects
- Production-ready manifest generation with resource controls
