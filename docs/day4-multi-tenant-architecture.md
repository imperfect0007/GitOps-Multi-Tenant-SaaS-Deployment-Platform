# Day 4 — Multi-Tenant Architecture

## Goal

Implement namespace-level tenant isolation so each customer gets their own secure, resource-controlled environment — all deployed automatically via GitOps.

```
Multiple users → Isolated namespaces → Secure deployments → Auto-managed by ArgoCD
```

---

## Architecture

```
                    Platform
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     tenant-a      tenant-b     tenant-c
   (namespace)    (namespace)   (future)
       │               │
   ┌───┴───┐      ┌───┴───┐
   │ nginx │      │ nginx │
   │ 2 pods│      │ 2 pods│
   └───────┘      └───────┘
```

Each namespace has:
- **ResourceQuota** — caps total CPU/memory/pod usage
- **LimitRange** — sets default per-container resource requests/limits
- **NetworkPolicy** — blocks cross-tenant traffic

---

## What Was Created

### Per-Tenant Infrastructure (applied via kubectl)

Each tenant gets 4 manifests in `infrastructure/kubernetes/base/tenants/<tenant>/`:

| File                | Purpose                                      |
|---------------------|----------------------------------------------|
| `namespace.yaml`    | Creates the isolated namespace               |
| `resource-quota.yaml` | Caps: 5 pods, 2 CPU req, 4 CPU limit, 2Gi/4Gi memory |
| `limit-range.yaml`  | Defaults: 200m/500m CPU, 256Mi/512Mi memory  |
| `network-policy.yaml`| Blocks all ingress/egress except same-tenant + DNS |

### Per-Tenant Applications (deployed via ArgoCD)

Each tenant has app manifests in the gitops-repo at `tenants/<tenant>/nginx/`:

| File              | Purpose                            |
|-------------------|------------------------------------|
| `deployment.yaml` | nginx:1.27-alpine, 2 replicas     |
| `service.yaml`    | ClusterIP service on port 80       |

### ArgoCD Applications

| App Name         | GitOps Path               | Target Namespace | Auto-Sync |
|------------------|---------------------------|------------------|-----------|
| `tenant-a-nginx` | `tenants/tenant-a/nginx`  | `tenant-a`       | Yes       |
| `tenant-b-nginx` | `tenants/tenant-b/nginx`  | `tenant-b`       | Yes       |

---

## Resource Quota in Action

Example from tenant-a after deployment:

```
Resource                Used   Hard
--------                ----   ----
pods                    2      5
requests.cpu            200m   2
requests.memory         256Mi  2Gi
limits.cpu              400m   4
limits.memory           512Mi  4Gi
services                1      5
```

Tenant is using 2 of 5 allowed pods. If they try to exceed 5, Kubernetes rejects the request.

---

## Network Isolation

Each tenant's NetworkPolicy:

- **Ingress:** only from pods in the same tenant namespace
- **Egress:** only to same tenant namespace + kube-system (for DNS)
- **Effect:** tenant-a pods cannot communicate with tenant-b pods

---

## Cluster State After Day 4

```
Kubernetes Cluster (minikube)
 │
 ├── namespace: default
 │      └── nginx (4 replicas) ← Day 3 GitOps app
 │
 ├── namespace: tenant-a
 │      ├── nginx (2 replicas) ← managed by ArgoCD
 │      ├── nginx-service (ClusterIP)
 │      ├── ResourceQuota: 5 pods, 2/4 CPU, 2Gi/4Gi mem
 │      ├── LimitRange: 200m-500m CPU, 256Mi-512Mi mem
 │      └── NetworkPolicy: tenant isolation
 │
 ├── namespace: tenant-b
 │      ├── nginx (2 replicas) ← managed by ArgoCD
 │      ├── nginx-service (ClusterIP)
 │      ├── ResourceQuota: 5 pods, 2/4 CPU, 2Gi/4Gi mem
 │      ├── LimitRange: 200m-500m CPU, 256Mi-512Mi mem
 │      └── NetworkPolicy: tenant isolation
 │
 └── namespace: argocd
        └── 3 Applications: nginx-app, tenant-a-nginx, tenant-b-nginx
```

---

## How the Backend Will Use This (Future)

When the FastAPI backend creates a new tenant:

```
1. Create namespace          → kubectl create namespace tenant-x
2. Apply resource quota      → enforce resource limits
3. Apply limit range         → set container defaults
4. Apply network policy      → isolate from other tenants
5. Generate app manifests    → deployment.yaml, service.yaml
6. Commit to gitops-repo     → tenants/tenant-x/app-name/
7. Create ArgoCD Application → auto-sync enabled
8. ArgoCD deploys            → app running in isolated namespace
```

This is the same pattern used by platforms like Heroku, Render, and Railway.

---

## Key Concepts

- **Namespace isolation** — each tenant is a separate Kubernetes namespace
- **ResourceQuota** — prevents any tenant from consuming all cluster resources
- **LimitRange** — ensures every container has sensible resource defaults
- **NetworkPolicy** — blocks cross-tenant network traffic
- **GitOps per tenant** — each tenant has its own ArgoCD Application
