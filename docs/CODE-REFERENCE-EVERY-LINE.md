# Code Reference — Every Line Explained

This document explains **every file**, **every function**, **every important line**, and **why it's used** in the GitOps Multi-Tenant SaaS Deployment Platform. Use it to understand the entire codebase and answer any interview question about the code.

---

## Table of Contents

1. [Backend — App Entry (main.py)](#1-backend--app-entry-mainpy)
2. [Backend — Config (config.py)](#2-backend--config-configpy)
3. [Backend — Database (database.py)](#3-backend--database-databasepy)
4. [Backend — Security (security.py)](#4-backend--security-securitypy)
5. [Backend — Exception Handler (exceptions.py)](#5-backend--exception-handler-exceptionspy)
6. [Backend — Models (User, Tenant, Project)](#6-backend--models)
7. [Backend — Schemas (Pydantic)](#7-backend--schemas-pydantic)
8. [Backend — Auth Routes](#8-backend--auth-routes)
9. [Backend — Tenant Routes](#9-backend--tenant-routes)
10. [Backend — Tenant Service (K8s Namespace)](#10-backend--tenant-service-k8s-namespace)
11. [Backend — Project Routes](#11-backend--project-routes)
12. [Backend — Project Service (Deploy Pipeline)](#12-backend--project-service-deploy-pipeline)
13. [Backend — Deployments Routes (K8s Monitoring)](#13-backend--deployments-routes-k8s-monitoring)
14. [Backend — Deployments Service (K8s API)](#14-backend--deployments-service-k8s-api)
15. [Backend — GitOps Manifests (YAML Generation)](#15-backend--gitops-manifests-yaml-generation)
16. [Backend — GitOps Service (Git Push)](#16-backend--gitops-service-git-push)
17. [Frontend — Entry (main.jsx, App.jsx)](#17-frontend--entry)
18. [Frontend — API Service (api.js)](#18-frontend--api-service-apijs)
19. [Frontend — Components (Layout, ProtectedRoute)](#19-frontend--components)
20. [Frontend — Pages](#20-frontend--pages)
21. [CI/CD — GitHub Actions (deploy.yml)](#21-cicd--github-actions)
22. [Infrastructure — K8s Manifests](#22-infrastructure--k8s-manifests)
23. [Docker — Backend and Frontend](#23-docker--backend-and-frontend)

---

## 1. Backend — App Entry (main.py)

**File:** `backend/app/main.py`  
**Purpose:** Creates the FastAPI app, wires all middleware, exception handlers, and routers.

| Line(s) | What | Why |
|---------|------|-----|
| `import logging` | Python's built-in logging | Used to log startup/shutdown events |
| `from contextlib import asynccontextmanager` | Async context manager decorator | FastAPI's lifespan replaces deprecated `on_event("startup")` |
| `from fastapi import FastAPI` | FastAPI class | Creates the web application |
| `from fastapi.middleware.cors import CORSMiddleware` | CORS middleware | Allows the React frontend (different port) to call the API |
| `from app.core.database import init_db` | Our DB init function | Creates all tables on startup |
| `from app.core.exceptions import global_exception_handler` | Our 500 handler | Catches any unhandled exception, logs it, returns clean JSON |
| `import app.models` | Side-effect import | Forces Python to load User, Tenant, Project models so SQLAlchemy's `Base.metadata` knows about them before `init_db()` |
| `from app.auth.routes import router as auth_router` (+ tenant, project, deployment routers) | Route modules | Each module handles a group of endpoints |
| `logging.basicConfig(level=logging.INFO)` | Set log level | INFO means we see request logs, startup messages, warnings |
| **`lifespan` function** | Async context manager | Code before `yield` runs on startup; code after runs on shutdown |
| `init_db()` | Called at startup | Creates DB tables if they don't exist (SQLAlchemy `create_all`) |
| `app = FastAPI(title=..., lifespan=lifespan)` | Create app | title/description appear in Swagger docs at `/docs`; lifespan handles startup |
| `app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)` | Enable CORS | `allow_origins=["*"]` means any origin can call the API — required for local dev where frontend is on port 3000 and API on 8001 |
| `app.add_exception_handler(Exception, global_exception_handler)` | Global catch-all | Any exception not caught by route code returns 500 JSON (not an HTML stack trace) |
| `app.include_router(auth_router, prefix="/auth")` | Mount auth routes | All auth endpoints start with `/auth/` (e.g. `/auth/login`) |
| `app.include_router(tenant_router, prefix="/tenants")` | Mount tenant routes | All tenant endpoints start with `/tenants/` |
| `app.include_router(project_router, prefix="")` | Mount project routes | Mounted at root because routes already include `/tenants/{id}/projects` |
| `app.include_router(deployment_router, prefix="")` | Mount deployment routes | Same — routes already have full paths |
| `@app.get("/health")` | Health check | Returns `{"status": "ok"}` — used by load balancers and Kubernetes liveness probes |

---

## 2. Backend — Config (config.py)

**File:** `backend/app/core/config.py`  
**Purpose:** Centralized configuration. Reads from environment variables and `.env` file.

| Setting | Default | Why |
|---------|---------|-----|
| `APP_NAME` | `"GitOps SaaS Platform"` | Display name |
| `DEBUG` | `True` | Toggle debug mode |
| `DATABASE_URL` | `sqlite:///./gitops_platform.db` | SQLite for local dev; override with PostgreSQL URL in production |
| `SECRET_KEY` | `"change-me-..."` | Used to sign JWT tokens — **must be random in production** (`openssl rand -hex 32`) |
| `ALGORITHM` | `"HS256"` | JWT signing algorithm (HMAC-SHA256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT token lives 1 hour |
| `GITOPS_REPO_PATH` | Parent dir + `/gitops-repo` | Where the GitOps repo is cloned on disk |
| `GITOPS_REPO_URL` | GitHub URL | Remote URL for clone/push — in `.env` this includes the token for auth |
| `GIT_BRANCH` | `"main"` | Branch to push manifests to |
| `KUBECONFIG_PATH` | `None` | If set, use this kubeconfig; else auto-detect (in-cluster or `~/.kube/config`) |
| `BASE_DOMAIN` | `""` (empty) | When set (e.g. `local.dev`), Ingress and custom domain are generated per project |
| `TLS_ENABLED` | `False` | When True, Ingress gets TLS section + cert-manager annotation |
| `CERT_MANAGER_ISSUER` | `"letsencrypt-prod"` | ClusterIssuer name for cert-manager |
| `INGRESS_CLASS` | `"nginx"` | Ingress controller class |
| `class Config: env_file = ".env"` | — | Pydantic-settings loads values from `backend/.env` automatically |
| `extra = "ignore"` | — | Unknown env vars are ignored (no error if `.env` has extra keys) |
| `settings = Settings()` | Singleton | One global instance imported everywhere as `from app.core.config import settings` |

---

## 3. Backend — Database (database.py)

**File:** `backend/app/core/database.py`  
**Purpose:** SQLAlchemy engine, session factory, base class, and DB dependency.

| Code | Why |
|------|-----|
| `engine = create_engine(settings.DATABASE_URL, connect_args=...)` | Create DB connection pool. `check_same_thread=False` is needed only for SQLite because SQLite objects can only be used in the thread they were created in, but FastAPI is async/multi-threaded |
| `SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)` | Session factory. `autocommit=False` means we control transactions (explicit `db.commit()`). `autoflush=False` means changes aren't sent to DB until we commit — gives us control |
| `class Base(DeclarativeBase)` | All ORM models inherit from this. SQLAlchemy uses `Base.metadata` to know which tables to create |
| `def get_db()` | **FastAPI dependency**. Called via `Depends(get_db)` in every route that needs DB access. Uses `yield` so the session is **always closed** in `finally`, even if the route throws an error. This prevents connection leaks |
| `def init_db()` | Calls `Base.metadata.create_all(bind=engine)` — creates all tables that don't exist yet. Safe to call multiple times (it's a no-op if tables exist) |

---

## 4. Backend — Security (security.py)

**File:** `backend/app/core/security.py`  
**Purpose:** Password hashing, JWT creation/verification, and auth dependencies.

| Function | What it does | Why |
|----------|-------------|-----|
| `pwd_context = CryptContext(schemes=["bcrypt"])` | Password hashing context | bcrypt is slow by design — resistant to brute force |
| `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")` | Extracts token from `Authorization: Bearer <token>` header | Also tells Swagger UI where to send credentials |
| `hash_password(password)` | Returns bcrypt hash of plaintext password | Stored in DB; original password is never stored |
| `verify_password(plain, hashed)` | Returns True if plain matches hash | Used during login |
| `create_access_token(data)` | Creates JWT with `data` + `exp` claim | `exp` = now + 60 minutes; signed with `SECRET_KEY` using `HS256` |
| `get_current_user(token, db)` | **FastAPI dependency** — decodes JWT, loads user from DB | Used in every protected route via `Depends(get_current_user)`. Raises 401 if token invalid/expired, user not found, or user not active. Import of `User` is inside the function to avoid circular imports |
| `require_admin(token, db)` | Same as get_current_user + checks `user.is_admin` | Returns 403 if not admin; used for admin-only endpoints |

---

## 5. Backend — Exception Handler (exceptions.py)

**File:** `backend/app/core/exceptions.py`  
**Purpose:** Global catch-all for unhandled exceptions.

| What | Why |
|------|-----|
| Logs: method, path, exception, full traceback | Developer can see exactly what happened in server logs |
| Returns: `{"detail": "Internal server error", "type": "MaxRetryError"}` | Client gets a clean JSON error (no stack trace leaked) |
| `type` field | Helps debugging — you know it was MaxRetryError vs ValueError etc. without exposing internals |

---

## 6. Backend — Models

### `models/__init__.py`
Imports User, Tenant, Project. **Why:** When `main.py` does `import app.models`, all three models are registered with SQLAlchemy's `Base.metadata`. Without this, `init_db()` wouldn't know about them.

### `models/user.py` — User model
| Column | Type | Why |
|--------|------|-----|
| `id` | Integer, PK | Unique identifier |
| `email` | String, unique, indexed | For login/registration; indexed for fast lookup |
| `username` | String, unique, indexed | Used for login |
| `hashed_password` | String | bcrypt hash — never store plain passwords |
| `role` | String, default "user" | Role-based access: "user" or "admin" |
| `is_active` | Boolean, default True | Soft-disable accounts without deleting data |
| `created_at` | DateTime, `server_default=func.now()` | Set by DB when row is created |
| `updated_at` | DateTime, `onupdate=func.now()` | Auto-updated when row changes |
| `tenants` relationship | One-to-many with cascade | Deleting a user deletes their tenants (and cascades to projects) |
| `is_admin` property | Computed | `True` when `role == "admin"` — used in `require_admin` |

### `models/tenant.py` — Tenant model
| Column | Why |
|--------|-----|
| `name` | Human-readable name (e.g. "acme-corp") |
| `namespace` | K8s namespace (e.g. "tenant-acme-corp") — auto-generated, unique |
| `owner_id` | FK to users — every tenant belongs to one user |
| `owner` relationship | Many-to-one back to User |
| `projects` relationship | One-to-many with cascade delete |

### `models/project.py` — Project model
| Column | Why |
|--------|-----|
| `name` | Project name (e.g. "webapp") |
| `image` | Container image (e.g. "nginx:1.27-alpine") |
| `replicas` | How many pods (default 2) |
| `port` | Container port (default 80) |
| `repo_url` | Optional: user's source repo URL |
| `status` | Tracks lifecycle: "pending" → "deploying" → "deployed" or "failed: ..." |
| `tenant_id` | FK to tenants — every project belongs to one tenant |

---

## 7. Backend — Schemas (Pydantic)

Pydantic models validate request/response data and generate OpenAPI docs.

### `schemas/auth.py`
| Schema | Used for | Fields |
|--------|----------|--------|
| `UserRegister` | POST /auth/register request body | email (validated as email), username, password |
| `UserLogin` | POST /auth/login request body | username, password |
| `UserResponse` | API response for user data | id, email, username, role, is_active, created_at. `from_attributes = True` lets Pydantic read from SQLAlchemy ORM objects |
| `TokenResponse` | POST /auth/login response | access_token, token_type ("bearer") |

### `schemas/tenant.py`
| Schema | Used for |
|--------|----------|
| `TenantCreate` | Request: just `name` — namespace is auto-generated |
| `TenantResponse` | Response: id, name, namespace, owner_id, timestamps |

### `schemas/project.py`
| Schema | Used for |
|--------|----------|
| `ProjectCreate` | Request: name, image (default nginx), replicas, port, optional repo_url |
| `ProjectResponse` | Response: all fields + `domain` (e.g. `webapp.tenant-acme.local.dev` when BASE_DOMAIN is set) |

---

## 8. Backend — Auth Routes

**File:** `backend/app/auth/routes.py`

| Endpoint | What happens |
|----------|-------------|
| **POST /auth/register** | Validates email/username not taken → hashes password with bcrypt → creates User → returns 201 with user data |
| **POST /auth/login** | Finds user by username → verifies password against bcrypt hash → creates JWT with `sub=user.id` → returns token |
| **GET /auth/me** | Requires valid JWT (`get_current_user` dependency) → returns current user's info |

**Why JWT?** Stateless authentication — the server doesn't store sessions. The token contains the user ID and expiry, signed with a secret. Any server instance can verify it.

---

## 9. Backend — Tenant Routes

**File:** `backend/app/tenants/routes.py`

| Endpoint | What happens |
|----------|-------------|
| **POST /tenants/** | Checks name unique → calls `create_kubernetes_namespace(name)` (wrapped in try/except so it works even if cluster is down) → saves Tenant in DB → returns 201 |
| **GET /tenants/** | Returns current user's tenants (filtered by `owner_id`), paginated |
| **GET /tenants/{id}** | Returns tenant only if current user owns it; else 404 |
| **DELETE /tenants/{id}** | Ownership check → tries to delete K8s namespace (ignores errors) → deletes from DB → 204 |

**Why the try/except on create?** If Minikube/K8s is down, we still want the tenant created in the DB. The namespace can be created later. This is **graceful degradation**.

---

## 10. Backend — Tenant Service (K8s Namespace)

**File:** `backend/app/tenants/service.py`

| Function | What it does | Why |
|----------|-------------|-----|
| `_load_k8s_config()` | Tries in-cluster config first, falls back to kubeconfig | In-cluster works when running inside K8s; kubeconfig for local dev |
| `_sanitize_namespace(name)` | Lowercase, replace non-[a-z0-9-] with "-", prefix "tenant-" | K8s namespace names must be DNS-compatible. Prefix prevents collisions with system namespaces |
| `create_kubernetes_namespace(name)` | Creates: Namespace → ResourceQuota → LimitRange → NetworkPolicy | Full tenant isolation in one call. Wrapped in try/except: if cluster is unreachable, logs warning and still returns the namespace name |
| `_apply_resource_quota(v1, ns)` | Limits: 5 pods, 2/4 CPU, 2Gi/4Gi memory, 5 services | **Why:** Prevents one tenant from consuming all cluster resources (noisy neighbor problem) |
| `_apply_limit_range(v1, ns)` | Default container: 200m/500m CPU, 256Mi/512Mi memory | **Why:** Ensures every container gets default limits even if not specified. Prevents unbounded resource usage |
| `_apply_network_policy(ns)` | Ingress: only from same namespace. Egress: same namespace + kube-system UDP 53 | **Why:** Tenant isolation — Tenant A's pods cannot talk to Tenant B's pods. kube-system exception allows DNS resolution |
| `delete_kubernetes_namespace(ns)` | Deletes namespace (ignores 404) | Used when tenant is deleted |

---

## 11. Backend — Project Routes

**File:** `backend/app/projects/routes.py`

| Function/Endpoint | What it does |
|-------------------|-------------|
| `_get_owned_tenant(tenant_id, db, user)` | Helper: returns tenant only if user owns it. Reused in every project endpoint |
| `_project_response(project, namespace)` | Builds ProjectResponse with `domain` field populated when BASE_DOMAIN is set |
| **POST /tenants/{id}/projects** | Ownership check → unique name check → create Project (status "deploying") → call `deploy_project()` → set status "deployed" or "failed: ..." → return project with domain |
| **GET /tenants/{id}/projects** | Paginated list of projects for that tenant, with domain |
| **GET /projects/{id}** | Get single project (ownership check via tenant) |
| **DELETE /projects/{id}** | Ownership check → delete from DB |

**Why status "deploying" → "deployed"/"failed"?** The deploy pipeline (Git push + ArgoCD) can fail. We track the outcome so the dashboard shows the right status.

---

## 12. Backend — Project Service (Deploy Pipeline)

**File:** `backend/app/projects/service.py`

This is the **core of the platform** — the full deploy pipeline.

### `deploy_project(name, namespace, image, replicas, port)`

| Step | What happens | Why |
|------|-------------|-----|
| 1. `generate_deployment(...)` | Creates Deployment YAML with health probes, resource limits | Health probes: K8s knows if the app is healthy and can restart it. Resource limits: prevents resource starvation |
| 2. `generate_service(...)` | Creates ClusterIP Service | Internal load balancer — routes traffic to pods by label selector |
| 3. If `BASE_DOMAIN` set: `generate_ingress(...)` | Creates Ingress with custom domain, optional TLS | External access via domain name. TLS adds HTTPS |
| 4. `push_manifests(namespace, name, manifests)` | Writes YAML to GitOps repo, commits, pushes to GitHub | **This is the GitOps principle**: Git is the source of truth, not kubectl |
| 5. `_create_argocd_application(name, namespace)` | Creates ArgoCD Application CR in the cluster | Tells ArgoCD to watch this Git path and auto-deploy. Gracefully skips if cluster is unreachable |

### `_create_argocd_application(name, namespace)`

| What | Why |
|------|-----|
| Loads K8s config | Needed to talk to K8s API |
| Builds ArgoCD Application body | source: GitOps repo path. destination: tenant namespace. syncPolicy: automated with prune and selfHeal |
| `prune: True` | Deletes resources removed from Git |
| `selfHeal: True` | If someone manually changes cluster state, ArgoCD reverts it to match Git |
| Creates or patches (409 = already exists) | Idempotent — safe to call multiple times |
| Outer try/except catches everything | If cluster is down, logs warning and continues. Manifests are in Git; ArgoCD will sync when cluster recovers |

---

## 13. Backend — Deployments Routes (K8s Monitoring)

**File:** `backend/app/deployments/routes.py`

| Endpoint | What it does |
|----------|-------------|
| **GET /tenants/{id}/deployments** | Returns projects from **database** (not live K8s). Optional `status_filter`. Includes `domain` |
| **GET /deployments/{id}/status** | Returns project's DB status + **live K8s deployment status** (replicas, conditions) |
| **GET /tenants/{id}/k8s/deployments** | Returns **live K8s deployments** in namespace (name, replicas, status) |
| **GET /tenants/{id}/k8s/pods** | Returns **live pods** (name, phase, app label, ready) |
| **GET /tenants/{id}/k8s/logs/{pod}** | Returns pod **logs** (tail N lines) |

**Why both DB and K8s endpoints?** DB endpoints work even when cluster is down (shows what was deployed). K8s endpoints show real-time state (actual running pods and logs).

---

## 14. Backend — Deployments Service (K8s API)

**File:** `backend/app/deployments/service.py`

| Function | K8s API call | Returns |
|----------|-------------|---------|
| `list_namespace_deployments(ns)` | `apps_v1.list_namespaced_deployment` | List of `{name, ready_replicas, desired_replicas, status}` |
| `list_namespace_pods(ns)` | `v1.list_namespaced_pod` | List of `{name, status, app, ready}` |
| `get_pod_logs(ns, pod, tail)` | `v1.read_namespaced_pod_log` | Log text (string) |
| `get_deployment_status(name, ns)` | `apps_v1.read_namespaced_deployment` | `{available/ready/desired_replicas, conditions}` |

**Error handling:** Every function catches both `ApiException` (K8s API errors) and generic `Exception` (cluster unreachable). Returns empty arrays or error dicts — never crashes the request.

---

## 15. Backend — GitOps Manifests (YAML Generation)

**File:** `backend/app/gitops/manifests.py`

### `generate_deployment(name, namespace, image, replicas, port, add_probes=True)`

Builds a Kubernetes Deployment dict and returns `yaml.dump()`.

| Part | Why |
|------|-----|
| `metadata.labels: {app: name, tenant: namespace}` | Labels are used by Service selector and NetworkPolicy |
| `spec.replicas` | How many pod copies to run |
| `spec.selector.matchLabels` | Must match template labels — K8s uses this to find pods owned by this Deployment |
| `resources.requests` | Minimum resources K8s guarantees for this container |
| `resources.limits` | Maximum resources — container is killed if it exceeds memory limit |
| `livenessProbe` (HTTP GET /) | K8s restarts the container if this probe fails. `initialDelaySeconds: 10` gives the app time to start |
| `readinessProbe` (HTTP GET /) | K8s removes the pod from Service endpoints if not ready. Prevents routing traffic to unhealthy pods |

### `generate_service(name, namespace, port)`

| Part | Why |
|------|-----|
| `type: ClusterIP` | Internal-only IP — accessible within the cluster. External access goes through Ingress |
| `selector: {app: name, tenant: namespace}` | Matches pods from the Deployment |
| `port/targetPort` | Service port maps to container port |

### `generate_ingress(name, namespace, host, service_name, service_port, ...)`

| Part | Why |
|------|-----|
| `ingressClassName: nginx` | Tells K8s which Ingress controller handles this Ingress |
| `rules[0].host` | Custom domain (e.g. `webapp.tenant-acme.local.dev`) |
| `rules[0].http.paths[0].backend.service` | Routes traffic to the Service |
| `tls` section (optional) | Enables HTTPS. `secretName` is where cert-manager stores the certificate |
| `annotations: cert-manager.io/cluster-issuer` | Tells cert-manager which issuer to use for automatic certificate provisioning |

### `generate_argocd_application(name, tenant_namespace, repo_url, branch)`

Generates ArgoCD Application YAML (used as reference; actual Application is created via K8s API in `projects/service.py`).

---

## 16. Backend — GitOps Service (Git Push)

**File:** `backend/app/gitops/service.py`

| Function | What | Why |
|----------|------|-----|
| `_get_repo()` | If `GITOPS_REPO_PATH` has no `.git`, clone from URL; else open existing | Caches the clone — only clones once, reuses on subsequent deploys |
| `push_manifests(tenant_ns, project_name, manifests)` | mkdir `tenants/{ns}/{project}/` → write each file → `git add` → `git commit` → `git push` | This is the GitOps write path. Commit message: "deploy {project} in {namespace}" |
| `remove_project(tenant_ns, project_name)` | `shutil.rmtree` the project dir → `git add` → commit → push | ArgoCD's `prune: true` will delete the K8s resources when the manifests disappear from Git |

**Why Git push instead of kubectl?** GitOps principle: Git is the source of truth. Every change is auditable (`git log`), reversible (`git revert`), and declarative. ArgoCD handles the actual cluster state.

---

## 17. Frontend — Entry

### `dashboard/src/main.jsx`
| Line | Why |
|------|-----|
| `<StrictMode>` | React development checks (double-render to catch side effects, warn about deprecated APIs) |
| `createRoot(document.getElementById('root')).render(...)` | React 18+ API — mounts the app into `<div id="root">` in `index.html` |
| `import './index.css'` | Global CSS (includes Tailwind's `@import "tailwindcss"`) |

### `dashboard/src/App.jsx`
| Code | Why |
|------|-----|
| `<BrowserRouter>` | Enables client-side routing (URL changes without full page reload) |
| `<Route path="/login">` / `<Route path="/register">` | Public routes — no auth required |
| `<ProtectedRoute><Layout /></ProtectedRoute>` | All other routes require a JWT token. Layout provides the sidebar |
| `<Route index ... Navigate to="/dashboard">` | Visiting `/` redirects to `/dashboard` |
| Child routes: `dashboard`, `tenants`, `tenants/new`, `tenants/:id`, `projects/new`, `monitoring` | Each renders inside `<Layout>`'s `<Outlet />` |
| `<Route path="*" ... Navigate to="/dashboard">` | Catch-all: unknown URLs redirect to dashboard |

### `dashboard/vite.config.js`
| Config | Why |
|--------|-----|
| `plugins: [react(), tailwindcss()]` | React JSX support + Tailwind CSS v4 processing |
| `server.port: 3000` | Default dev server port |
| `proxy: { '/api': { target: 'http://localhost:8000', rewrite: ... } }` | Optional: allows calling `/api/tenants` from frontend which proxies to `http://localhost:8000/tenants` (alternative to CORS) |

---

## 18. Frontend — API Service (api.js)

**File:** `dashboard/src/services/api.js`

| Code | Why |
|------|-----|
| `baseURL = import.meta.env.VITE_API_URL \|\| 'http://localhost:8000'` | Configurable backend URL. Set via `dashboard/.env` for different environments |
| `API = axios.create({...})` | Single Axios instance — all requests go through this |
| **Request interceptor** | Before every request: reads JWT from `localStorage`, adds `Authorization: Bearer <token>` header. This is how the backend knows who's calling |
| **Response interceptor** | On 401: if user isn't on login/register page, clears token and redirects to `/login`. This handles expired tokens gracefully |
| Auth exports: `register`, `login`, `getMe` | Each is a one-liner Axios call |
| Tenant exports: `createTenant`, `listTenants`, `getTenant`, `deleteTenant` | CRUD for tenants |
| Project exports: `createProject(tenantId, data)`, `listProjects`, etc. | tenantId is part of the URL |
| K8s exports: `getK8sDeployments`, `getK8sPods`, `getPodLogs` | Live cluster data for monitoring |

---

## 19. Frontend — Components

### `ProtectedRoute.jsx`
| What | Why |
|------|-----|
| Reads `token` from `localStorage` | JWT is stored here after login |
| If no token → `<Navigate to="/login">` | Redirects unauthenticated users |
| If token → renders `children` | Allows access to protected pages |

### `Layout.jsx`
| What | Why |
|------|-----|
| Sidebar with nav links | Dashboard, Tenants, New Tenant, New Project, Monitoring |
| Active link styling | `bg-emerald-500/15` when `location.pathname === path` |
| Sign out button | Removes token from localStorage, navigates to `/login` |
| `<Outlet />` | React Router renders the matched child route here |

---

## 20. Frontend — Pages

### `Login.jsx`
- Form: username + password
- On submit: calls `login()` API → stores JWT in `localStorage` → navigates to `/dashboard`
- Uses **inline styles** (not Tailwind classes) so it always looks correct even if CSS fails to load
- Error handling: shows API error message

### `Register.jsx`
- Form: email + username + password
- On submit: calls `register()` → navigates to `/login`
- Same inline styles approach as Login

### `Dashboard.jsx`
- Fetches `getMe()` + `listTenants()` in parallel on mount
- Shows welcome message with username
- Shows tenant list with links + quick actions (create tenant, deploy project)

### `TenantList.jsx`
- Fetches `listTenants({limit: 100})`
- Table: name (link to detail), namespace, created date
- "New tenant" button

### `TenantDetail.jsx`
- Fetches `getTenant(id)` + `listProjects(id)`
- Shows tenant name, namespace, project list with status badges
- "Deploy project" link

### `CreateTenant.jsx`
- Form: tenant name
- On submit: calls `createTenant({name})` → navigates to `/tenants`

### `CreateProject.jsx`
- Loads tenants for dropdown
- Form: tenant (select), name, image, replicas, port
- On submit: calls `createProject(tenantId, data)` → navigates to tenant detail

### `Monitoring.jsx`
- Tenant dropdown (loads all tenants)
- Fetches `getK8sDeployments`, `getK8sPods`, `listProjects` in parallel
- **Auto-refreshes every 5 seconds** (`setInterval`)
- Shows cluster unreachable banner when K8s data is empty
- **K8s table** (when cluster is up): deployment name, status (Running/Failed/Pending), replicas, "View Logs" button
- **Platform Projects table** (always): project name, image, status, domain, replicas
- **Logs modal**: select pod → select tail lines → fetch and display logs in `<pre>` block

---

## 21. CI/CD — GitHub Actions

**File:** `.github/workflows/deploy.yml`

| Section | What | Why |
|---------|------|-----|
| `on: push: branches: [main]` | Triggered on every push to main | Automates the build-deploy cycle |
| **Job 1: build-and-push** | Checkout → Docker Buildx → Login to Docker Hub → Build+push backend image → Build+push frontend image | Produces versioned Docker images (`:latest` + `:SHA`) with layer caching |
| **Job 2: update-gitops** | Conditional: `if: vars.GITOPS_UPDATE_ENABLED == 'true'` | Only runs if you set this variable in GitHub repo settings |
| Clone GitOps repo with token | `git clone https://token@github.com/...` | Needs write access to push |
| Update deployment.yaml with new image | `sed -i 's\|image:.*\|image: new-image\|'` | ArgoCD will detect the change and deploy the new image |
| Commit and push | `git commit -m "ci: update platform-backend image"` | Triggers ArgoCD auto-sync |

**Why not use `secrets` in `if`?** GitHub Actions doesn't allow `secrets` in `if` conditions. We use `vars.GITOPS_UPDATE_ENABLED` (a repository variable) instead.

---

## 22. Infrastructure — K8s Manifests

### `infrastructure/kubernetes/ingress/cluster-issuer.yaml`
- **ClusterIssuer** for cert-manager using Let's Encrypt ACME
- HTTP-01 challenge solver via nginx Ingress
- **Why:** Automatic HTTPS certificates without manual setup

### `infrastructure/kubernetes/ingress/app-ingress-example.yaml`
- Example Ingress with TLS for `webapp.tenant-a.yourplatform.com`
- Shows how cert-manager annotation triggers certificate creation

### `infrastructure/kubernetes/ingress/hpa-example.yaml`
- **HorizontalPodAutoscaler** example: scales deployment between 1-10 replicas based on CPU (70% target)
- **Why:** Auto-scales apps under load

---

## 23. Docker — Backend and Frontend

### `backend/Dockerfile`
| Line | Why |
|------|-----|
| `FROM python:3.11-slim` | Small base image |
| `RUN apt-get install git` | GitPython needs git to clone/push the GitOps repo |
| `COPY requirements.txt` + `pip install` | Install deps before copying code (Docker layer caching — deps change less often than code) |
| `EXPOSE 8000` | Documents the port (doesn't actually publish it) |
| `CMD uvicorn app.main:app --host 0.0.0.0 --port 8000` | Runs the app on all interfaces so it's reachable in Docker/K8s |

### `dashboard/Dockerfile` (multi-stage)
| Stage | What | Why |
|-------|------|-----|
| Stage 1: `node:20-alpine AS builder` | `npm ci` → `npm run build` → produces `dist/` | Builds the React app |
| Stage 2: `nginx:alpine` | Copies `dist/` into nginx html root | Final image is tiny (~25MB) — only nginx + static files. No Node.js runtime |
| `try_files $uri $uri/ /index.html` | SPA fallback: all routes serve `index.html` so React Router handles them |

---

## Key Design Decisions Summary

| Decision | Why |
|----------|-----|
| FastAPI (not Flask/Django) | Async, auto-docs, Pydantic validation, dependency injection |
| SQLAlchemy (not raw SQL) | Type-safe ORM, migration support, database-agnostic |
| JWT (not sessions) | Stateless auth — scales horizontally without session store |
| GitOps (not kubectl apply) | Auditable, reversible, declarative, self-healing via ArgoCD |
| ArgoCD (not Flux) | Mature, has UI, widely adopted, good CRD support |
| React + Vite (not Next.js) | Simple SPA, fast HMR, no SSR needed |
| Inline styles for Login/Register | Works even if Tailwind CSS fails to load |
| Graceful degradation | Platform works even when K8s cluster is down |
| Multi-stage Docker build | Small production images |
| Namespace per tenant | K8s-native isolation boundary |
| ResourceQuota + LimitRange + NetworkPolicy | Defense in depth: resource limits + network isolation |
