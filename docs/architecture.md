# System Architecture — GitOps Multi-Tenant SaaS Platform

## 1. Problem Statement

Build a GitOps-based multi-tenant SaaS platform where users can deploy applications to Kubernetes by connecting their Git repository.

The platform will automatically:

- Create isolated infrastructure per tenant
- Generate Kubernetes manifests (Deployment, Service, Ingress)
- Deploy applications via GitOps using ArgoCD

### User Journey

```
Login → Create Project → Connect Git Repo → Deploy → Running on Kubernetes
```

---

## 2. Core Components

### 2.1 Frontend Dashboard (React)

The user-facing interface for managing the platform.

**Responsibilities:**
- User authentication (login / signup)
- Tenant and project management
- Deployment status and history
- Logs and metrics visualization

**Tech:** React, Tailwind CSS

---

### 2.2 Backend API (FastAPI)

The core engine of the platform. Handles all business logic and orchestration.

**Responsibilities:**
- JWT-based authentication
- Tenant lifecycle management
- Project creation and configuration
- Kubernetes manifest generation
- GitOps repo automation (commit manifests)
- Deployment status tracking

**Tech:** FastAPI, Python, SQLAlchemy, Pydantic

---

### 2.3 GitOps Repository

A Git repository that serves as the **single source of truth** for all deployments. The backend writes Kubernetes manifests here, and ArgoCD reads from it.

**Structure:**

```
gitops-repo/
└── tenants/
    ├── company-a/
    │   ├── project-1/
    │   │   ├── deployment.yaml
    │   │   ├── service.yaml
    │   │   └── ingress.yaml
    │   └── project-2/
    │       ├── deployment.yaml
    │       ├── service.yaml
    │       └── ingress.yaml
    └── company-b/
        └── project-1/
            ├── deployment.yaml
            ├── service.yaml
            └── ingress.yaml
```

When the backend commits to this repo, ArgoCD automatically detects and deploys.

---

### 2.4 Kubernetes Cluster

The runtime environment for all tenant applications and platform services.

**Runs:**
- Tenant applications (in isolated namespaces)
- ArgoCD (GitOps controller)
- Ingress Controller (NGINX)
- Prometheus + Grafana (monitoring)

**Per-tenant isolation:**
- Dedicated Kubernetes namespace
- ResourceQuotas (CPU and memory limits)
- NetworkPolicies (restrict cross-tenant traffic)

---

### 2.5 GitOps Engine (ArgoCD)

ArgoCD continuously watches the GitOps repository. When manifests change, it reconciles the desired state with the cluster.

**Key behaviors:**
- Polls the GitOps repo for changes
- Compares desired state (Git) vs actual state (cluster)
- Auto-syncs or manual-syncs based on policy
- Reports sync status back to the platform

---

## 3. High-Level Architecture

```
                 User
                  │
                  ▼
         ┌─────────────────┐
         │ React Dashboard │
         └────────┬────────┘
                  │ REST API calls
                  ▼
         ┌─────────────────┐
         │  FastAPI Backend│
         └──┬──────┬──────┬┘
            │      │      │
            ▼      ▼      ▼
      ┌─────┐  ┌─────┐  ┌───────────┐
      │PgSQL│  │Redis│  │GitOps Repo│
      └─────┘  └─────┘  └─────┬─────┘
                               │ Git push triggers
                               ▼
                        ┌───────────┐
                        │  ArgoCD   │
                        └─────┬─────┘
                              │ Reconcile
                              ▼
                     ┌──────────────────┐
                     │ Kubernetes       │
                     │ Cluster          │
                     │                  │
                     │  ┌────────────┐  │
                     │  │ ns: co-a   │  │
                     │  │  app1 app2 │  │
                     │  └────────────┘  │
                     │  ┌────────────┐  │
                     │  │ ns: co-b   │  │
                     │  │  app1      │  │
                     │  └────────────┘  │
                     └──────────────────┘
```

---

## 4. Data Flow — Deployment Pipeline

This is the core flow that powers the entire platform.

```
┌──────┐    ┌──────────┐    ┌───────────┐    ┌────────┐    ┌────────────┐
│ User │-──▶│ Platform │───▶│ GitOps    │───▶│ ArgoCD │───▶│ Kubernetes │
│      │    │ API      │    │ Repo      │    │        │    │ Cluster    │
└──────┘    └──────────┘    └───────────┘    └────────┘    └────────────┘
  Create       Generate        Commit          Detect         Deploy
  Project      K8s YAML        to Git          Change         to Cluster
```

### Step-by-Step:

1. **User creates a project** via the React dashboard
2. **Backend generates Kubernetes manifests:**
   - `deployment.yaml` — defines the application pod spec
   - `service.yaml` — exposes the application internally
   - `ingress.yaml` — routes external traffic to the service
3. **Backend commits manifests** to the GitOps repo under `tenants/<tenant>/<project>/`
4. **ArgoCD detects the new commit** and compares desired vs actual state
5. **ArgoCD applies the manifests** to the Kubernetes cluster
6. **Application is live** in the tenant's namespace

---

## 5. Multi-Tenant Isolation Model

### Namespace-per-Tenant Strategy

Each tenant is mapped to a Kubernetes namespace. All of a tenant's projects run inside that namespace.

```
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-company-a
  labels:
    platform: gitops-saas
    tenant: company-a
```

### Resource Quotas

Prevent any single tenant from consuming all cluster resources.

```
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-quota
  namespace: tenant-company-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
```

### Network Policies

Restrict traffic so tenants cannot communicate with each other.

```
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: tenant-isolation
  namespace: tenant-company-a
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              tenant: company-a
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              tenant: company-a
    - to:    # Allow DNS resolution
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
```

---

## 6. Tech Stack Summary

| Layer          | Technology           | Purpose                            |
|----------------|----------------------|------------------------------------|
| Frontend       | React, Tailwind CSS  | User dashboard                     |
| Backend API    | FastAPI, Python      | Core platform logic                |
| Database       | PostgreSQL           | Users, tenants, projects metadata  |
| Cache/Queue    | Redis                | Session cache, background jobs     |
| Auth           | JWT                  | Stateless authentication           |
| Containers     | Docker               | Application packaging              |
| Orchestration  | Kubernetes           | Runtime for all workloads          |
| IaC            | Terraform            | Cloud infrastructure provisioning  |
| Packaging      | Helm                 | Kubernetes application packaging   |
| GitOps         | ArgoCD               | Continuous deployment from Git     |
| CI/CD          | GitHub Actions       | Build, test, and push pipelines    |
| Monitoring     | Prometheus           | Metrics collection                 |
| Dashboards     | Grafana              | Metrics visualization              |

---

## 7. API Design Overview (Planned)

### Auth
| Method | Endpoint            | Description          |
|--------|---------------------|----------------------|
| POST   | `/api/auth/signup`  | Register a new user  |
| POST   | `/api/auth/login`   | Login and get JWT    |
| GET    | `/api/auth/me`      | Get current user     |

### Tenants
| Method | Endpoint             | Description            |
|--------|----------------------|------------------------|
| POST   | `/api/tenants`       | Create a new tenant    |
| GET    | `/api/tenants`       | List user's tenants    |
| GET    | `/api/tenants/{id}`  | Get tenant details     |

### Projects
| Method | Endpoint                          | Description             |
|--------|-----------------------------------|-------------------------|
| POST   | `/api/tenants/{id}/projects`      | Create a new project    |
| GET    | `/api/tenants/{id}/projects`      | List tenant's projects  |
| GET    | `/api/projects/{id}`              | Get project details     |

### Deployments
| Method | Endpoint                          | Description               |
|--------|-----------------------------------|---------------------------|
| POST   | `/api/projects/{id}/deploy`       | Trigger a deployment      |
| GET    | `/api/projects/{id}/deployments`  | List deployment history   |
| GET    | `/api/deployments/{id}/status`    | Get deployment status     |

---

## 8. Security Considerations

- **Authentication:** JWT tokens with short expiry + refresh tokens
- **Authorization:** Role-based access (tenant admin, member, viewer)
- **Secrets:** Kubernetes Secrets for sensitive config, never stored in Git
- **Network:** NetworkPolicies for tenant isolation, TLS termination at Ingress
- **RBAC:** Kubernetes RBAC per namespace to limit ArgoCD scope

---

## 9. Roadmap

| Day | Focus                                          |
|-----|------------------------------------------------|
| 1   | System design, architecture, project structure |
| 2   | Backend project setup (FastAPI, Docker, DB)    |
| 3   | Authentication system (JWT)                    |
| 4   | Tenant and project management APIs             |
| 5   | GitOps automation (manifest generation)        |
| 6   | Kubernetes manifests and Helm charts           |
| 7   | ArgoCD integration                             |
| 8   | Frontend dashboard (React)                     |
| 9   | CI/CD with GitHub Actions                      |
| 10  | Monitoring (Prometheus + Grafana)              |
