# GitOps Multi-Tenant SaaS Deployment Platform

A **production-grade** platform that enables users to deploy applications to Kubernetes using GitOps principles — similar to how **Vercel**, **Heroku**, or **Render** work internally.

Users sign up, create tenants (organizations), deploy projects, and the platform automatically generates Kubernetes manifests, pushes them to a GitOps repo, and ArgoCD syncs them to the cluster — with tenant isolation, custom domains, HTTPS, CI/CD, and a monitoring dashboard.

**Live Repos:**
- Platform: [GitOps-Multi-Tenant-SaaS-Deployment-Platform](https://github.com/imperfect0007/GitOps-Multi-Tenant-SaaS-Deployment-Platform)
- GitOps: [gitops-repo](https://github.com/imperfect0007/gitops-repo)

---

## Table of Contents

- [What This Project Does](#what-this-project-does)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Deployment Flow (End to End)](#deployment-flow-end-to-end)
- [Multi-Tenant Design](#multi-tenant-design)
- [Key Features](#key-features)
- [API Endpoints](#api-endpoints)
- [GitOps Pipeline](#gitops-pipeline)
- [CI/CD Pipeline](#cicd-pipeline)
- [Day 10 — Production Setup](#day-10--production-setup)
- [How to Run Locally](#how-to-run-locally)
- [Interview Q&A — Pin-to-Pin](#interview-qa--pin-to-pin)
- [Resume Line](#resume-line)

---

## What This Project Does

```
User signs up → Creates a tenant (org) → Deploys a project
    → Backend generates K8s manifests (Deployment, Service, Ingress)
    → Pushes to GitOps repo
    → ArgoCD detects change → Deploys to Kubernetes
    → App is live at custom domain with HTTPS
```

This is exactly how platforms like **Vercel** and **Heroku** work under the hood — except you built it from scratch.

---

## Architecture

```
                        User (Browser)
                            │
                            ▼
                    React Dashboard (Vite + Tailwind)
                            │  REST API (JWT auth)
                            ▼
                    FastAPI Backend (Python)
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
        SQLite/PG       GitOps Repo     Kubernetes API
        (Users,         (GitHub)        (Namespaces,
         Tenants,           │            Quotas,
         Projects)          │            Pods)
                            ▼
                        ArgoCD
                        (watches repo)
                            │
                            ▼
                    Kubernetes Cluster
            ┌───────────┼───────────┐
            ▼           ▼           ▼
        tenant-a    tenant-b    tenant-c
        (isolated)  (isolated)  (isolated)
            │           │           │
         Deployment  Deployment  Deployment
         Service     Service     Service
         Ingress     Ingress     Ingress
```

| Component | Technology | Role |
|-----------|-----------|------|
| Frontend | React 19, Vite, Tailwind CSS 4 | Dashboard UI — login, tenants, projects, monitoring |
| Backend | FastAPI, Python 3.11, SQLAlchemy | Core API — auth, tenant/project CRUD, manifest generation, GitOps push, K8s API |
| Database | SQLite (dev) / PostgreSQL (prod) | Stores users, tenants, projects |
| GitOps Repo | GitHub (git) | Single source of truth for all K8s manifests |
| CD | ArgoCD | Watches GitOps repo, auto-syncs to cluster |
| Orchestrator | Kubernetes (Minikube locally) | Runs tenant workloads in isolated namespaces |
| Ingress | NGINX Ingress Controller | Routes traffic to apps via custom domains |
| TLS/HTTPS | cert-manager + Let's Encrypt | Automatic SSL certificates |
| CI/CD | GitHub Actions | Build Docker images, push to Docker Hub, update GitOps repo |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 8, Tailwind CSS 4, Axios, React Router 7 |
| **Backend** | FastAPI, Python 3.11, SQLAlchemy 2, Pydantic 2, Alembic |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Database** | SQLite (dev) / PostgreSQL (prod) |
| **GitOps** | GitPython (clone, commit, push to GitHub) |
| **K8s Client** | official `kubernetes` Python SDK |
| **Manifests** | PyYAML — generates Deployment, Service, Ingress YAML |
| **Container** | Docker (multi-stage builds for frontend) |
| **Orchestration** | Kubernetes 1.34 (Minikube for local) |
| **CD** | ArgoCD v3 (auto-sync, self-heal, prune) |
| **Ingress** | NGINX Ingress Controller |
| **TLS** | cert-manager + Let's Encrypt ClusterIssuer |
| **CI/CD** | GitHub Actions (build, push, optional GitOps update) |

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, routes, middleware, lifespan
│   │   ├── core/
│   │   │   ├── config.py           # Settings (env, JWT, GitOps, K8s, domain)
│   │   │   ├── database.py         # SQLAlchemy engine, session, Base
│   │   │   ├── security.py         # JWT create/decode, password hash/verify, get_current_user
│   │   │   └── exceptions.py       # Global 500 handler with traceback logging
│   │   ├── models/
│   │   │   ├── user.py             # User (email, username, hashed_password, role)
│   │   │   ├── tenant.py           # Tenant (name, namespace, owner_id)
│   │   │   └── project.py          # Project (name, image, replicas, port, status)
│   │   ├── schemas/
│   │   │   ├── auth.py             # UserRegister, UserLogin, TokenResponse
│   │   │   ├── tenant.py           # TenantCreate, TenantResponse
│   │   │   └── project.py          # ProjectCreate, ProjectResponse (+ domain)
│   │   ├── auth/routes.py          # POST /register, /login, GET /me
│   │   ├── tenants/
│   │   │   ├── routes.py           # CRUD + ownership checks
│   │   │   └── service.py          # K8s namespace + quota + limits + network policy
│   │   ├── projects/
│   │   │   ├── routes.py           # CRUD + deploy on create
│   │   │   └── service.py          # Generate manifests → push GitOps → create ArgoCD app
│   │   ├── deployments/
│   │   │   ├── routes.py           # K8s deployments, pods, logs per tenant
│   │   │   └── service.py          # K8s API calls for live cluster data
│   │   └── gitops/
│   │       ├── manifests.py        # generate_deployment, generate_service, generate_ingress
│   │       └── service.py          # Clone, write, commit, push to GitOps repo
│   ├── alembic/                    # DB migrations
│   ├── requirements.txt
│   ├── Dockerfile                  # Python 3.11-slim + git
│   └── .dockerignore
│
├── dashboard/                      # React frontend
│   ├── src/
│   │   ├── main.jsx, App.jsx       # Entry, routing, protected routes
│   │   ├── components/             # Layout (sidebar), ProtectedRoute
│   │   ├── pages/                  # Login, Register, Dashboard, Tenants, Projects, Monitoring
│   │   └── services/api.js         # Axios client (auth interceptor, all API calls)
│   ├── Dockerfile                  # Multi-stage: Node build → nginx serve
│   └── .dockerignore
│
├── infrastructure/kubernetes/
│   ├── base/                       # Example K8s manifests (namespaces, ArgoCD apps)
│   └── ingress/                    # ClusterIssuer, Ingress example, HPA example
│
├── .github/workflows/deploy.yml    # CI/CD: build images → push → update GitOps
│
└── docs/                           # Day-by-day guides + complete reference
    ├── day2-infrastructure-setup.md
    ├── day3-gitops-pipeline.md
    ├── day4-multi-tenant-architecture.md
    ├── day5-fastapi-backend.md
    ├── day6-production-backend.md
    ├── day7-frontend-dashboard.md
    ├── day8-deployment-monitoring.md
    ├── day9-cicd-pipeline.md
    ├── day10-production-setup.md
    ├── architecture.md
    └── COMPLETE-PROJECT-REFERENCE.md  # Every file, every line explained
```

---

## Deployment Flow (End to End)

This is the **most important section** for interviews. Walk through what happens when a user creates a project:

### Step 1 — User creates a project via dashboard
- Frontend calls `POST /tenants/{id}/projects` with `{ name, image, replicas, port }`.
- JWT token in header authenticates the user.

### Step 2 — Backend validates and saves
- `projects/routes.py`: Checks user owns the tenant, project name is unique.
- Creates Project row in DB with status `"deploying"`.

### Step 3 — Generate Kubernetes manifests
- `gitops/manifests.py`:
  - `generate_deployment()` — Deployment YAML with health probes, resource limits.
  - `generate_service()` — ClusterIP Service.
  - `generate_ingress()` — Ingress with custom domain and optional TLS (if `BASE_DOMAIN` is set).

### Step 4 — Push to GitOps repo
- `gitops/service.py`: Clones the GitOps repo (if not cloned), writes files to `tenants/{namespace}/{project}/`, commits, and pushes to GitHub.
- **This is the GitOps principle**: Git is the source of truth, not `kubectl apply`.

### Step 5 — Create ArgoCD Application
- `projects/service.py`: Creates an ArgoCD `Application` custom resource that watches `tenants/{namespace}/{project}/` in the GitOps repo. ArgoCD auto-syncs: it detects the new manifests and applies them to the cluster.

### Step 6 — Kubernetes runs the app
- ArgoCD creates the Deployment, Service, and Ingress in the tenant namespace.
- The app is reachable at `{project}.{namespace}.{BASE_DOMAIN}` via the Ingress controller.

### Step 7 — Monitoring
- Dashboard calls `GET /tenants/{id}/k8s/deployments`, `/k8s/pods`, `/k8s/logs/{pod}`.
- Backend uses the `kubernetes` Python SDK to query live cluster data.
- Dashboard auto-refreshes every 5 seconds.

```
Frontend → Backend → GitOps Repo → ArgoCD → Kubernetes → App Running
                                                ↑
                                    Monitoring (live pods, logs)
```

---

## Multi-Tenant Design

Each tenant gets **complete isolation** in Kubernetes:

### 1. Namespace
```python
namespace = f"tenant-{sanitized_name}"  # e.g. tenant-acme
```

### 2. ResourceQuota
```yaml
pods: "5"
requests.cpu: "2"
requests.memory: "2Gi"
limits.cpu: "4"
limits.memory: "4Gi"
services: "5"
```

### 3. LimitRange (per container defaults)
```yaml
default:         { cpu: 500m, memory: 512Mi }
defaultRequest:  { cpu: 200m, memory: 256Mi }
```

### 4. NetworkPolicy (tenant isolation)
- **Ingress**: Only from pods in the same tenant namespace.
- **Egress**: Only to same tenant namespace + kube-system (DNS on UDP 53).
- Cross-tenant traffic is **blocked**.

### 5. Custom Domain per project
```
{project}.{namespace}.{BASE_DOMAIN}
e.g. webapp.tenant-acme.yourplatform.com
```

---

## Key Features

| Feature | How It Works |
|---------|-------------|
| **JWT Auth** | Register/login returns JWT; every API call includes `Authorization: Bearer <token>`; backend decodes and loads user |
| **Tenant Isolation** | Separate K8s namespace + quota + limits + network policy per tenant |
| **GitOps Deployments** | Backend generates YAML, pushes to Git; ArgoCD syncs to cluster |
| **Custom Domains** | Each project gets `{name}.{namespace}.{BASE_DOMAIN}` with Ingress |
| **HTTPS (TLS)** | cert-manager + Let's Encrypt ClusterIssuer; automatic certificate provisioning |
| **Health Probes** | Generated Deployments include liveness + readiness probes |
| **Monitoring Dashboard** | Live K8s deployments, pods, status, logs — auto-refresh every 5s |
| **CI/CD** | GitHub Actions: build Docker images, push to Docker Hub, optionally update GitOps repo |
| **Graceful Degradation** | Tenant/project creation works even when K8s cluster is down (namespace created later) |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | `/auth/register` | No | Create user account |
| POST | `/auth/login` | No | Get JWT token |
| GET | `/auth/me` | Yes | Current user info |
| POST | `/tenants/` | Yes | Create tenant (+ K8s namespace) |
| GET | `/tenants/` | Yes | List user's tenants |
| GET | `/tenants/{id}` | Yes | Get tenant details |
| DELETE | `/tenants/{id}` | Yes | Delete tenant (+ K8s namespace) |
| POST | `/tenants/{id}/projects` | Yes | Create project (triggers full deploy pipeline) |
| GET | `/tenants/{id}/projects` | Yes | List projects |
| GET | `/projects/{id}` | Yes | Get project (includes `domain`) |
| DELETE | `/projects/{id}` | Yes | Delete project |
| GET | `/tenants/{id}/deployments` | Yes | List deployments (DB) |
| GET | `/deployments/{id}/status` | Yes | Live K8s deployment status |
| GET | `/tenants/{id}/k8s/deployments` | Yes | Live K8s deployments in namespace |
| GET | `/tenants/{id}/k8s/pods` | Yes | Live pods in namespace |
| GET | `/tenants/{id}/k8s/logs/{pod}` | Yes | Pod logs (tail N lines) |

---

## GitOps Pipeline

```
Backend commits to:
  gitops-repo/tenants/{namespace}/{project}/
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml

ArgoCD Application watches:
  source:
    repoURL: https://github.com/imperfect0007/gitops-repo.git
    path: tenants/{namespace}/{project}
  destination:
    namespace: {namespace}
  syncPolicy:
    automated: { prune: true, selfHeal: true }
```

- **prune: true** — deletes resources removed from Git.
- **selfHeal: true** — if someone manually changes something in the cluster, ArgoCD reverts it to match Git.

---

## CI/CD Pipeline

**File:** `.github/workflows/deploy.yml`

**Trigger:** Push to `main` branch.

```
Push to main
    │
    ▼
Job 1: build-and-push
    ├── Build backend Docker image → push to Docker Hub (latest + SHA tag)
    └── Build frontend Docker image → push to Docker Hub (latest + SHA tag)
    │
    ▼
Job 2: update-gitops (optional, if GITOPS_UPDATE_ENABLED=true)
    ├── Clone GitOps repo
    ├── Update image tag in deployment.yaml
    ├── Commit and push
    └── ArgoCD auto-deploys the new image
```

**Secrets needed:** `DOCKER_USERNAME`, `DOCKER_PASSWORD`
**Optional:** `GITOPS_REPO_URL`, `GITOPS_TOKEN`, variable `GITOPS_UPDATE_ENABLED=true`

---

## Day 10 — Production Setup

The final layer that makes this production-grade:

| Feature | Implementation |
|---------|---------------|
| **NGINX Ingress** | `minikube addons enable ingress` — routes external traffic to apps |
| **cert-manager** | Automatic TLS certificates from Let's Encrypt |
| **ClusterIssuer** | `infrastructure/kubernetes/ingress/cluster-issuer.yaml` |
| **Custom Domains** | `{project}.{namespace}.{BASE_DOMAIN}` — set `BASE_DOMAIN` in `.env` |
| **Health Probes** | Liveness + readiness probes on every generated Deployment |
| **HPA** | Example HorizontalPodAutoscaler for CPU-based scaling |
| **Graceful Degradation** | Backend works even when cluster is down |

---

## How to Run Locally

### Prerequisites
- Python 3.11+, Node.js 18+, Docker Desktop, Minikube, kubectl

### 1. Start Minikube
```bash
minikube start --driver=docker --cpus=2 --memory=3072
minikube addons enable ingress
```

### 2. Install ArgoCD
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
```

### 3. Start Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # edit settings
uvicorn app.main:app --reload --port 8000
```

### 4. Start Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### 5. Use the Platform
- Open http://localhost:3000
- Register → Login → Create Tenant → Create Project
- Manifests are pushed to GitOps repo → ArgoCD deploys → Monitor in dashboard

---

## Interview Q&A — Pin to Pin

### "Explain your project in 30 seconds"

> I built a GitOps-based multi-tenant SaaS deployment platform. Users sign up, create tenants (like organizations), and deploy projects. When they deploy, my backend generates Kubernetes manifests — Deployment, Service, Ingress — pushes them to a GitOps repo on GitHub, and ArgoCD automatically syncs those manifests to the Kubernetes cluster. Each tenant is isolated with their own namespace, resource quotas, and network policies. The platform also has CI/CD with GitHub Actions, a monitoring dashboard with live pod status and logs, and supports custom domains with HTTPS via cert-manager.

### "What happens when a user clicks Deploy?"

> 1. Frontend sends POST /tenants/{id}/projects with JWT auth.
> 2. Backend validates ownership, creates a Project in the DB.
> 3. Backend generates three YAML files: Deployment (with health probes and resource limits), Service (ClusterIP), and Ingress (with custom domain and optional TLS).
> 4. Backend clones the GitOps repo (if not cached), writes files to tenants/{namespace}/{project}/, commits, and pushes.
> 5. Backend creates an ArgoCD Application custom resource pointing at that Git path.
> 6. ArgoCD detects the new commit, applies the manifests to the tenant namespace.
> 7. The app runs in Kubernetes, reachable at the custom domain via the Ingress controller.

### "How do you achieve tenant isolation?"

> Each tenant gets a dedicated Kubernetes namespace (e.g. tenant-acme). Inside that namespace I create: a ResourceQuota (limiting pods, CPU, memory, services), a LimitRange (default container resource requests/limits), and a NetworkPolicy that only allows ingress from the same namespace and egress to the same namespace + kube-system for DNS. This means Tenant A cannot see or communicate with Tenant B's pods, and no tenant can exceed their resource allocation.

### "Why GitOps? Why not just kubectl apply?"

> GitOps makes Git the single source of truth. Every change is auditable (git log), reversible (git revert), and declarative. ArgoCD continuously reconciles the cluster state with what's in Git. If someone manually changes something in the cluster, ArgoCD's self-heal reverts it. If a deployment breaks, I can just revert the Git commit and ArgoCD automatically rolls back.

### "How does ArgoCD work here?"

> When a project is deployed, the backend creates an ArgoCD Application CR in the argocd namespace. That Application points at a specific path in the GitOps repo (e.g. tenants/tenant-acme/webapp/). ArgoCD polls the repo every ~3 minutes (or gets a webhook). When it detects a change, it applies the YAML to the target namespace. I enable automated sync with prune (delete removed resources) and selfHeal (revert manual cluster changes).

### "How does authentication work?"

> User registers with email/username/password. Password is hashed with bcrypt via passlib. On login, the backend creates a JWT with the user ID in the `sub` claim, signed with a secret key using HS256, with a 60-minute expiry. Every API request includes `Authorization: Bearer <token>`. The `get_current_user` dependency decodes the JWT, loads the user from the DB, and checks `is_active`. If invalid, it returns 401.

### "How does the CI/CD pipeline work?"

> On every push to main, GitHub Actions runs two jobs. Job 1 builds both the backend and frontend Docker images using multi-stage builds, then pushes them to Docker Hub with both a `latest` tag and a Git SHA tag. Job 2 (optional) clones the GitOps repo, updates the image tag in the deployment manifest, commits, and pushes — so ArgoCD picks up the new image automatically. Docker layer caching via GitHub Actions cache makes builds fast.

### "What happens if the Kubernetes cluster goes down?"

> The platform degrades gracefully. Tenant creation still works — the tenant is saved in the DB with the namespace name, and the K8s namespace is created later when the cluster recovers. Project creation pushes manifests to the GitOps repo, but the ArgoCD step is skipped with a warning. The monitoring page shows a banner saying "Kubernetes cluster is unreachable" and displays project data from the database instead. When the cluster comes back up, ArgoCD auto-syncs everything.

### "How do custom domains and HTTPS work?"

> When `BASE_DOMAIN` is set (e.g. yourplatform.com), the backend generates an Ingress manifest for each project with host `{project}.{namespace}.{domain}`. If `TLS_ENABLED` is true, the Ingress includes a TLS section and a cert-manager annotation pointing to a Let's Encrypt ClusterIssuer. cert-manager automatically creates a Certificate and provisions a TLS secret. The NGINX Ingress controller terminates TLS and routes traffic to the Service.

### "What would you improve with more time?"

> 1. **Webhooks** instead of ArgoCD polling — faster deployments.
> 2. **PostgreSQL** instead of SQLite for production.
> 3. **Deployment history** — store image versions, enable one-click rollback.
> 4. **Auto DNS provisioning** — Cloudflare/Route53 API to create DNS records.
> 5. **RBAC** — team-based access control within a tenant (admin, developer, viewer).
> 6. **Horizontal Pod Autoscaler** — auto-scale based on CPU/memory metrics.
> 7. **Billing integration** — track resource usage per tenant.

### "What design patterns did you use?"

> - **Repository pattern** (GitOps repo as single source of truth)
> - **Dependency injection** (FastAPI's Depends for DB sessions, auth)
> - **Service layer** (routes → service → external calls, separation of concerns)
> - **Factory pattern** (manifest generators produce YAML from parameters)
> - **Graceful degradation** (catch K8s errors, still serve users)
> - **Multi-stage Docker builds** (build step separate from runtime for small images)

---

## Resume Line

> Built a production-grade GitOps-based multi-tenant SaaS deployment platform using **Kubernetes**, **ArgoCD**, **Docker**, and **FastAPI**, enabling automated application deployments with **CI/CD pipelines**, **tenant isolation** (namespaces, quotas, network policies), **monitoring** (live pods, logs), and **secure HTTPS access** with custom domains.

---

## Documentation

| Doc | Description |
|-----|-------------|
| `docs/architecture.md` | Full system design with diagrams |
| `docs/COMPLETE-PROJECT-REFERENCE.md` | Every file, every line explained |
| `docs/day2-infrastructure-setup.md` | Minikube + ArgoCD setup |
| `docs/day3-gitops-pipeline.md` | GitOps repo + ArgoCD auto-deploy |
| `docs/day4-multi-tenant-architecture.md` | Namespace isolation, quotas, policies |
| `docs/day5-fastapi-backend.md` | Backend core setup |
| `docs/day6-production-backend.md` | K8s integration, deployments API |
| `docs/day7-frontend-dashboard.md` | React dashboard |
| `docs/day8-deployment-monitoring.md` | Live K8s monitoring |
| `docs/day9-cicd-pipeline.md` | Docker + GitHub Actions |
| `docs/day10-production-setup.md` | Ingress, HTTPS, custom domains |
| `docs/DAY10-INSTRUCTIONS-TO-SEE-IT-WORKING.md` | Step-by-step to run everything |
| `docs/ISSUES-AND-FIXES.md` | Known issues and troubleshooting |

---

## License

MIT
