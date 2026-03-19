# Complete Project Reference — Every File & Line Explained

This document explains **every important file** and **every line** in the GitOps Multi-Tenant SaaS Deployment Platform. Use it to understand the codebase from top to bottom.

---

## Table of Contents

1. [Project structure](#1-project-structure)
2. [Backend — core](#2-backend--core)
3. [Backend — models & schemas](#3-backend--models--schemas)
4. [Backend — auth](#4-backend--auth)
5. [Backend — tenants](#5-backend--tenants)
6. [Backend — projects](#6-backend--projects)
7. [Backend — deployments & K8s](#7-backend--deployments--k8s)
8. [Backend — GitOps](#8-backend--gitops)
9. [Backend — database migrations (Alembic)](#9-backend--database-migrations-alembic)
10. [Backend — Docker & config](#10-backend--docker--config)
11. [Frontend — entry & config](#11-frontend--entry--config)
12. [Frontend — routing & layout](#12-frontend--routing--layout)
13. [Frontend — API service](#13-frontend--api-service)
14. [Frontend — pages](#14-frontend--pages)
15. [CI/CD — GitHub Actions & Docker](#15-cicd--github-actions--docker)

---

## 1. Project structure

```
GitOps Multi-Tenant SaaS Deployment Platform/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py             # Application entry, routes, middleware
│   │   ├── core/               # Config, database, security, exceptions
│   │   ├── models/             # SQLAlchemy ORM models (User, Tenant, Project)
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── auth/               # Register, login, JWT
│   │   ├── tenants/            # Tenant CRUD + K8s namespace creation
│   │   ├── projects/           # Project CRUD + GitOps deployment
│   │   ├── deployments/        # Deployment status, K8s list, pod logs
│   │   └── gitops/             # Manifest generation + git push
│   ├── alembic/                # Database migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
├── dashboard/                  # React frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── main.jsx, App.jsx
│   │   ├── components/         # Layout, ProtectedRoute
│   │   ├── pages/              # Login, Register, Dashboard, Tenants, Projects, Monitoring
│   │   └── services/api.js     # Axios API client
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
├── .github/workflows/deploy.yml # CI/CD: build images, push, update GitOps
├── docs/                       # Day-by-day and reference docs
└── infrastructure-example/     # Example K8s manifests for GitOps repo
```

---

## 2. Backend — core

### `backend/app/main.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–2 | `import logging` / `from contextlib import asynccontextmanager` | Logging and async context manager for app lifespan (startup/shutdown). |
| 4–5 | `from fastapi import FastAPI` / `from fastapi.middleware.cors import CORSMiddleware` | FastAPI app and CORS middleware so the React app can call the API from another origin. |
| 6–13 | `from app.core.database import init_db` … `from app.deployments.routes import deployment_router` | Imports: database init, global exception handler, **all models** (so tables exist), and every router (auth, tenants, projects, deployments). |
| 15–16 | `logging.basicConfig` / `logger = ...` | Set default log level and create app logger. |
| 19–24 | `@asynccontextmanager` / `async def lifespan(...)` | **Lifespan**: on startup call `init_db()` to create DB tables; on shutdown log. `yield` is where the app runs. |
| 26–31 | `app = FastAPI(...)` | Create FastAPI app with title, description, version, and the lifespan (replaces deprecated `on_event`). |
| 33–39 | `app.add_middleware(CORSMiddleware, ...)` | Allow any origin, credentials, methods, headers so the dashboard can call the API. |
| 41 | `app.add_exception_handler(Exception, global_exception_handler)` | Any unhandled exception returns a JSON 500 and is logged with traceback (no stack trace to client). |
| 43–46 | `app.include_router(...)` | Mount auth at `/auth`, tenants at `/tenants`, projects and deployments at root (paths defined in their routers). |
| 49–51 | `@app.get("/health")` / `def health()` | Liveness endpoint: returns `{"status": "ok"}` for load balancers/health checks. |

---

### `backend/app/core/config.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–2 | `from pydantic_settings import BaseSettings` / `from pathlib import Path` | Load settings from env and build paths. |
| 5–9 | `class Settings(BaseSettings)` / `APP_NAME`, `DEBUG`, `DATABASE_URL` | App name and debug flag. `DATABASE_URL`: SQLite by default; override with e.g. `postgresql://...` in production. |
| 11–13 | `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT: secret for signing, algorithm, token lifetime in minutes. |
| 15–17 | `GITOPS_REPO_PATH`, `GITOPS_REPO_URL`, `GIT_BRANCH` | Where to clone/write the GitOps repo (path on disk, remote URL, branch). |
| 19 | `KUBECONFIG_PATH` | Optional path to kubeconfig; if unset, in-cluster or default kubeconfig is used. |
| 21–23 | `class Config` / `env_file = ".env"` / `extra = "ignore"` | Load from `.env`; ignore extra env vars so unknown vars don’t error. |
| 26 | `settings = Settings()` | Single global settings instance used across the app. |

---

### `backend/app/core/database.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–4 | Imports | SQLAlchemy engine, session, DeclarativeBase; app settings. |
| 6–9 | `engine = create_engine(...)` | Create DB engine from `DATABASE_URL`. `check_same_thread=False` only for SQLite (needed for FastAPI’s concurrent requests). |
| 11 | `SessionLocal = sessionmaker(...)` | Session factory: not autocommit, not autoflush, bound to the engine. |
| 14–15 | `class Base(DeclarativeBase)` | All ORM models inherit from this; Alembic uses `Base.metadata`. |
| 18–23 | `def get_db()` | Dependency: yields a DB session; closes it in a `finally` so every request gets a clean session. |
| 26–27 | `def init_db()` | Create all tables from `Base.metadata` (only if models were imported before, e.g. in `main.py`). |

---

### `backend/app/core/security.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–10 | Imports | datetime, jose (JWT), passlib (bcrypt), FastAPI Depends/HTTPException/OAuth2PasswordBearer, Session, settings, get_db. |
| 12 | `pwd_context = CryptContext(schemes=["bcrypt"], ...)` | Password hashing with bcrypt. |
| 13 | `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")` | Tells OpenAPI where to send username/password for token; used to read `Authorization: Bearer <token>`. |
| 16–17 | `def hash_password(password)` | Hash a plain password for storing in DB. |
| 20–21 | `def verify_password(plain, hashed)` | Return True if plain matches the hash. |
| 24–28 | `def create_access_token(data)` | Copy `data`, add `exp` (now + ACCESS_TOKEN_EXPIRE_MINUTES), encode JWT with SECRET_KEY and ALGORITHM. |
| 31–51 | `def get_current_user(token, db)` | Decode JWT, get `sub` (user id); if invalid or missing, raise 401. Load user from DB; if missing or `is_active` is False, raise 401/403. Return user. |
| 54–58 | `def require_admin(...)` | Same as get_current_user then check `user.is_admin` (role == "admin"); else 403. |

---

### `backend/app/core/exceptions.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–7 | Imports and logger | logging, traceback, Request, JSONResponse, logger. |
| 10–23 | `async def global_exception_handler(request, exc)` | Log method, path, exception, and full traceback. Return 500 JSON with `detail: "Internal server error"` and `type: exc.__class__.__name__` (no stack trace to client). |

---

## 3. Backend — models & schemas

### `backend/app/models/__init__.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–5 | Imports and `__all__` | Import User, Tenant, Project so that when another module does `import app.models`, SQLAlchemy registers these with `Base.metadata`. Required for `init_db()` and Alembic. |

---

### `backend/app/models/user.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–4 | Imports | Column types, relationship, Base. |
| 7–8 | `class User(Base)` / `__tablename__ = "users"` | ORM table name in DB. |
| 10–12 | `id`, `email`, `username`, `hashed_password` | Primary key; unique email/username; stored bcrypt hash. |
| 13–14 | `role`, `is_active` | role default "user"; is_active for soft disable. |
| 15–16 | `created_at`, `updated_at` | Timestamps; updated_at refreshed on row update. |
| 18 | `tenants = relationship(..., cascade="all, delete-orphan")` | One user has many tenants; deleting user deletes their tenants. |
| 20–22 | `@property is_admin` | True when role == "admin". |

---

### `backend/app/models/tenant.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 9–14 | Columns | id, name (unique), namespace (unique, K8s namespace), owner_id (FK to users), created_at, updated_at. |
| 16–17 | `owner`, `projects` | Many-to-one to User; one-to-many to Project with cascade delete. |

---

### `backend/app/models/project.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 10–17 | Columns | id, name, image (container image), replicas, port, repo_url (optional), status (e.g. "deployed"/"failed"), tenant_id (FK), created_at, updated_at. |
| 19 | `tenant` | Many-to-one to Tenant. |

---

### `backend/app/schemas/auth.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 5–8 | `UserRegister` | email (EmailStr), username, password — for POST /auth/register. |
| 11–13 | `UserLogin` | username, password — for POST /auth/login. |
| 16–26 | `UserResponse` | id, email, username, role, is_active, created_at; `from_attributes=True` so we can build from ORM User. |
| 29–31 | `TokenResponse` | access_token, token_type default "bearer". |

---

### `backend/app/schemas/tenant.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 5–6 | `TenantCreate` | name only — for creating a tenant. |
| 9–17 | `TenantResponse` | id, name, namespace, owner_id, created_at, updated_at. |

---

### `backend/app/schemas/project.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 5–10 | `ProjectCreate` | name, image (default nginx), replicas, port, repo_url optional. |
| 13–25 | `ProjectResponse` | All project fields the API returns. |

---

## 4. Backend — auth

### `backend/app/auth/routes.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 9 | `router = APIRouter(tags=["Authentication"])` | Group these routes under "Authentication" in OpenAPI. |
| 12–26 | `@router.post("/register", ...)` | Validate email/username not taken; create User with hashed password; add, commit, refresh, return UserResponse (201). |
| 30–36 | `@router.post("/login", ...)` | Find user by username; verify password; create JWT with `sub=user.id`; return TokenResponse. |
| 40–42 | `@router.get("/me", ...)` | Requires valid JWT (get_current_user); return current user as UserResponse. |

---

## 5. Backend — tenants

### `backend/app/tenants/routes.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 14–32 | `POST /` | Create tenant: check name unique, call `create_kubernetes_namespace(payload.name)`, save Tenant with name, namespace, owner_id, return 201. |
| 36–49 | `GET /` | List tenants for current user with pagination (skip, limit), ordered by created_at desc. |
| 52–64 | `GET /{tenant_id}` | Return tenant only if owner_id == current user; else 404. |
| 68–88 | `DELETE /{tenant_id}` | Same ownership check; try to delete K8s namespace (ignore errors); delete tenant from DB; 204. |

---

### `backend/app/tenants/service.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 10–15 | `_load_k8s_config()` | Prefer in-cluster config (when running in K8s); else load kubeconfig (local/dev). |
| 17–19 | `_sanitize_namespace(name)` | Lowercase, replace non-[a-z0-9-] with "-", prefix "tenant-". |
| 22–49 | `create_kubernetes_namespace(tenant_name)` | Create namespace with labels (platform, tenant, managed-by); apply resource quota, limit range, network policy; return namespace name. |
| 53–70 | `_apply_resource_quota` | Limit namespace to 5 pods, 2 CPU request, 4 CPU limit, 2Gi/4Gi memory, 5 services. |
| 73–91 | `_apply_limit_range` | Default container requests/limits (200m/500m CPU, 256Mi/512Mi memory). |
| 94–139 | `_apply_network_policy` | Ingress only from same tenant; egress to same tenant + kube-system (UDP 53 for DNS). |
| 142–150 | `delete_kubernetes_namespace` | Call K8s API to delete namespace; ignore 404. |

---

## 6. Backend — projects

### `backend/app/projects/routes.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 15–23 | `_get_owned_tenant(tenant_id, db, user)` | Return tenant only if owner_id == user.id; else raise 404. |
| 26–70 | `POST /tenants/{tenant_id}/projects` | Ensure user owns tenant; check project name unique in tenant; create Project (status "deploying"); call `deploy_project(...)`; set status "deployed" or "failed: ..."; commit and return project. |
| 74–89 | `GET /tenants/{tenant_id}/projects` | Ownership check; return paginated projects for that tenant. |
| 92–103 | `GET /projects/{project_id}` | Load project; ensure user owns its tenant; return project. |
| 106–117 | `DELETE /projects/{project_id}` | Same ownership; delete project from DB; 204. |

---

### `backend/app/projects/service.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 13–31 | `deploy_project(name, namespace, image, replicas, port)` | Generate deployment and service YAML via gitops.manifests; call `push_manifests` to write to GitOps repo and push; call `_create_argocd_application` so ArgoCD watches that path. |
| 35–90 | `_create_argocd_application(name, namespace)` | Build ArgoCD Application CR: source = GitOps repo path `tenants/{namespace}/{name}`, destination namespace, auto-sync. Create or patch (if 409) in argocd namespace. |

---

## 7. Backend — deployments & K8s

### `backend/app/deployments/routes.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 19–39 | `GET /tenants/{tenant_id}/deployments` | Ensure user owns tenant; return projects from DB (optional status_filter), paginated. |
| 42–68 | `GET /deployments/{project_id}/status` | Load project and tenant (ownership); call `get_deployment_status(project.name, tenant.namespace)`; return project_id, name, namespace, platform_status, kubernetes status. |
| 71–80 | `_get_tenant_namespace(tenant_id, db, user)` | Resolve tenant and check ownership; return tenant.namespace. |
| 83–91 | `GET /tenants/{tenant_id}/k8s/deployments` | Return list from K8s API (name, replicas, status) for that namespace. |
| 94–102 | `GET /tenants/{tenant_id}/k8s/pods` | Return list of pods (name, status, app label, ready) for that namespace. |
| 105–116 | `GET /tenants/{tenant_id}/k8s/logs/{pod_name}` | Query param `tail` (10–1000); return pod logs as `{ "logs": "...", "pod", "namespace" }`. |

---

### `backend/app/deployments/service.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 16–37 | `list_namespace_deployments(namespace)` | List deployments in namespace; for each return name, ready/desired/available replicas, status (Running / Failed / Pending). |
| 40–65 | `list_namespace_pods(namespace)` | List pods; return name, phase, app label, ready (from container status). |
| 68–84 | `get_pod_logs(namespace, pod_name, tail_lines)` | read_namespaced_pod_log with tail_lines; on error return error string. |
| 87–114 | `get_deployment_status(name, namespace)` | read_namespaced_deployment; return available/ready/desired and conditions; on 404 or error return dict with error. |

---

## 8. Backend — GitOps

### `backend/app/gitops/service.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 11–16 | `_get_repo()` | If GITOPS_REPO_PATH has no .git, clone from GITOPS_REPO_URL; else use existing repo. |
| 19–46 | `push_manifests(tenant_namespace, project_name, manifests)` | Ensure project dir `tenants/{namespace}/{project_name}` exists; write each file from dict (e.g. deployment.yaml, service.yaml); git add, commit message "deploy {project} in {namespace}", push to GIT_BRANCH. |
| 50–69 | `remove_project(tenant_namespace, project_name)` | Remove that directory; git add, commit "remove ...", push. |

---

### `backend/app/gitops/manifests.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 6–35 | `generate_deployment(name, namespace, image, replicas, port)` | Build dict: Deployment with metadata (name, namespace, labels app/tenant), spec (replicas, selector, template with one container: image, port, resource requests/limits). Return yaml.dump. |
| 38–52 | `generate_service(name, namespace, port)` | Service: name "{name}-service", ClusterIP, selector app/tenant, port. |
| 55–84 | `generate_argocd_application(...)` | ArgoCD Application YAML (source path, destination namespace, syncPolicy); used for reference; actual Application is created in projects.service via K8s API. |

---

## 9. Backend — database migrations (Alembic)

### `backend/alembic/env.py`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–9 | Imports and config | fileConfig for logging; engine_from_config, pool; context; settings, Base, import app.models. |
| 11–12 | `config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)` | Override alembic.ini URL with app’s DATABASE_URL. |
| 14–17 | `target_metadata = Base.metadata` | Alembic uses this to know which tables/columns exist. |
| 20–29 | `run_migrations_offline()` | Generate SQL without a live DB (e.g. for review). |
| 32–46 | `run_migrations_online()` | Create engine from config, connect, run migrations in a transaction; render_as_batch for SQLite compatibility. |
| 49–52 | `if context.is_offline_mode()` | Choose offline or online based on Alembic invocation. |

---

## 10. Backend — Docker & config

### `backend/Dockerfile`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1 | `FROM python:3.11-slim` | Base image: small Python 3.11. |
| 3 | `WORKDIR /app` | All following commands run in /app. |
| 5 | `RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf ...` | Install git (needed for GitPython to clone/push GitOps repo). |
| 7–8 | `COPY requirements.txt` / `RUN pip install ...` | Install Python dependencies. |
| 10 | `COPY . .` | Copy application code (respects .dockerignore). |
| 12 | `EXPOSE 8000` | Document that the app listens on 8000. |
| 14 | `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]` | Run the FastAPI app on all interfaces so it’s reachable in Docker/K8s. |

---

### `backend/.dockerignore`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–19 | List of patterns | Exclude __pycache__, .venv, .env, *.db, .git, tests, coverage, etc., so the image stays small and doesn’t bundle secrets or dev artifacts. |

---

### `backend/requirements.txt`

| Line | Package | Purpose |
|------|---------|--------|
| fastapi | Web framework |
| uvicorn[standard] | ASGI server |
| sqlalchemy | ORM |
| psycopg2-binary | PostgreSQL driver (production) |
| alembic | Migrations |
| python-jose[cryptography] | JWT |
| passlib[bcrypt] | Password hashing |
| python-multipart | Form data (OAuth2) |
| pydantic[email-validator] | Validation + email |
| pydantic-settings | Settings from env |
| gitpython | Git clone/commit/push |
| kubernetes | K8s API client |
| pyyaml | YAML for manifests |
| httpx | HTTP client (tests) |

---

## 11. Frontend — entry & config

### `dashboard/index.html`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–5 | `<!doctype html>` … `<meta charset="UTF-8" />` … `<meta name="viewport" ...>` | Standard HTML5; viewport for mobile. |
| 6–7 | `<title>`, `<link rel="icon"` | Page title and favicon. |
| 8–10 | `preconnect` and Google Fonts link | Preconnect to fonts; load Plus Jakarta Sans. |
| 12 | `<div id="root"></div>` | React mounts here. |
| 14 | `<script type="module" src="/src/main.jsx"></script>` | Entry point: main.jsx (Vite resolves it). |

---

### `dashboard/src/main.jsx`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–4 | Imports | StrictMode, createRoot, index.css, App. |
| 6–10 | `createRoot(document.getElementById('root')).render(...)` | Mount App inside StrictMode for development checks. |

---

### `dashboard/vite.config.js`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–5 | `defineConfig`, `react`, `tailwindcss` | Vite config; React and Tailwind plugins. |
| 5–6 | `plugins: [react(), tailwindcss()]` | Enable React and Tailwind v4. |
| 7–15 | `server` | Dev server port 3000; proxy /api to localhost:8000 and strip /api so frontend can call /api/tenants and hit backend /tenants. |

---

## 12. Frontend — routing & layout

### `dashboard/src/App.jsx`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–11 | Imports | BrowserRouter, Routes, Route, Navigate; ProtectedRoute, Layout; all page components. |
| 13–14 | `function App()` | Root component. |
| 15 | `<BrowserRouter>` | Enables client-side routing. |
| 16–17 | `<Route path="/login" element={<Login />} />` / same for register | Public routes: no auth. |
| 19–25 | `<Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>` | All other routes wrapped: require token, then render Layout (sidebar + outlet). |
| 27–33 | `<Route index ... Navigate to="/dashboard" />` and child routes | Index redirects to /dashboard; child routes: dashboard, tenants, tenants/new, tenants/:id, projects/new, monitoring. |
| 34 | `<Route path="*" element={<Navigate to="/dashboard" replace />} />` | Catch-all: unknown path redirect to dashboard. |

---

### `dashboard/src/components/ProtectedRoute.jsx`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 3–12 | `export default function ProtectedRoute({ children })` | Read token from localStorage; if no token, Navigate to /login (replace, keep location in state); else render children. |

---

### `dashboard/src/components/Layout.jsx`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 5–11 | `nav` array | Paths and labels for Dashboard, Tenants, New Tenant, New Project, Monitoring; each has an icon path for the sidebar SVG. |
| 13–16 | `handleLogout` | Remove token, navigate to /login. |
| 19–64 | JSX | Sidebar: logo link to /dashboard; nav links (active style for current path); Sign out button. Main area: `<Outlet />` for nested route content. |

---

## 13. Frontend — API service

### `dashboard/src/services/api.js`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–3 | `import axios` / `baseURL` | Axios; base URL from VITE_API_URL or http://localhost:8000. |
| 5–8 | `API = axios.create({ baseURL, headers })` | Single instance with JSON content type. |
| 10–14 | `API.interceptors.request.use` | Before every request: if token in localStorage, set Authorization: Bearer <token>. |
| 16–27 | `API.interceptors.response.use` | On 401: if path is not /login or /register, clear token and redirect to /login; then reject so callers can handle. |
| 29–32 | Auth exports | register, login, getMe. |
| 34–38 | Tenants | createTenant, listTenants, getTenant, deleteTenant. |
| 40–45 | Projects | createProject(tenantId, data), listProjects, getProject, deleteProject. |
| 47–51 | Deployments | listDeployments, getDeploymentStatus. |
| 53–59 | K8s monitoring | getK8sDeployments, getK8sPods, getPodLogs (pod name encoded in URL). |

---

## 14. Frontend — pages

- **Login.jsx** — Form: username, password. On submit call `login()`, store token, navigate to /dashboard. Uses inline styles so it always looks correct even if Tailwind fails. Error message and “Sign up” link.
- **Register.jsx** — Form: email, username, password. On submit call `register()`, then navigate to /login. Same style approach as Login.
- **Dashboard.jsx** — Fetches getMe() and listTenants(); shows welcome message and tenant list with links; quick links to create tenant / deploy project.
- **TenantList.jsx** — listTenants(); table of tenants (name, namespace, created); link to create and to tenant detail.
- **TenantDetail.jsx** — getTenant(id), listProjects(id); shows tenant name/namespace and project list with status; link to deploy project.
- **CreateTenant.jsx** — Form: name. createTenant({ name }); then navigate to /tenants.
- **CreateProject.jsx** — listTenants() for dropdown; form: tenant, name, image, replicas, port. createProject(tenantId, data); then navigate to tenant detail.
- **Monitoring.jsx** — Tenant dropdown; getK8sDeployments(tenantId), getK8sPods(tenantId) every 5s; table: Deployment, Status, Pods, View Logs. “View Logs” opens modal: choose pod (filtered by deployment app label), optional tail lines, getPodLogs() and show in &lt;pre&gt;.

---

## 15. CI/CD — GitHub Actions & Docker

### `.github/workflows/deploy.yml`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–4 | Comments | Trigger: push to main; required secrets: DOCKER_USERNAME, DOCKER_PASSWORD; optional: GITOPS_REPO_URL, GITOPS_TOKEN. |
| 6 | `name: CI/CD Pipeline` | Workflow name in Actions UI. |
| 8–11 | `on: push: branches: [main]` | Run on every push to main. |
| 13–15 | `env:` BACKEND_IMAGE, FRONTEND_IMAGE | Image names "backend" and "frontend". |
| 17–19 | `jobs: build-and-push:` / `runs-on: ubuntu-latest` | Single job on Ubuntu runner. |
| 21–23 | Checkout code | actions/checkout@v4. |
| 25–26 | Set up Docker Buildx | For better build cache and multi-platform if needed. |
| 28–32 | Login to Docker Hub | docker/login-action with DOCKER_USERNAME and DOCKER_PASSWORD. |
| 34–42 | Build and push backend | context ./backend; tags USERNAME/backend:latest and USERNAME/backend:SHA; GHA cache. |
| 44–53 | Build and push frontend | context ./dashboard; tags USERNAME/frontend:latest and :SHA; GHA cache. |
| 55–58 | `update-gitops` job | needs build-and-push; runs only if GITOPS_TOKEN and GITOPS_REPO_URL are set. |
| 61–65 | Clone GitOps repo | git clone using token; GITOPS_REPO_URL = owner/repo (e.g. imperfect0007/gitops-repo). |
| 67–76 | Update backend image | Create or update infrastructure/platform-backend/deployment.yaml with image USERNAME/backend:latest (sed or printf). |
| 79–88 | Commit and push | git add, commit "ci: update platform-backend image", push. |

---

### `dashboard/Dockerfile`

| Line(s) | Code | Explanation |
|---------|------|-------------|
| 1–2 | `# Stage 1: Build` / `FROM node:20-alpine AS builder` | Build stage: Node 20. |
| 4–10 | WORKDIR, COPY package*.json, npm ci, COPY ., npm run build | Install deps, copy source, produce dist/. |
| 12–13 | `# Stage 2` / `FROM nginx:alpine` | Final image: nginx only. |
| 15 | `COPY --from=builder /app/dist /usr/share/nginx/html` | Copy built assets into nginx root. |
| 16 | `RUN echo 'server { ... try_files $uri $uri/ /index.html; }' > ...` | SPA: all routes fallback to index.html. |
| 18–20 | EXPOSE 80 / CMD nginx | Listen on 80; run nginx in foreground. |

---

### `dashboard/.dockerignore`

Excludes node_modules, dist, .git, .env so the build context is small and reproducible.

---

## Summary

- **Backend**: FastAPI app in `main.py` wires config, database, security, and routers (auth, tenants, projects, deployments). Models and schemas define DB and API shapes. Tenants create K8s namespaces; projects generate manifests and push to GitOps and create ArgoCD Applications; deployments service talks to K8s for status, pods, and logs.
- **Frontend**: Vite + React app; main.jsx mounts App; App uses BrowserRouter and ProtectedRoute; Layout has sidebar and Outlet; api.js centralizes HTTP with auth header and 401 redirect. Pages use the API for auth, tenants, projects, and monitoring (with 5s refresh and logs modal).
- **CI/CD**: Push to main triggers build-and-push of backend and frontend images to Docker Hub; optionally updates a GitOps repo with the new backend image so ArgoCD can deploy.

This file plus the day-by-day docs (day2–day9) and architecture.md give you a full reference for every part of the project.
