# Day 8 — Deployment Monitoring Dashboard

## Goal

Turn the platform into an **observability layer**: users see live deployment status, pod counts, and pod logs from Kubernetes—no `kubectl` required.

```
User → Dashboard → See deployments → Status → Logs → Metrics
```

---

## What Was Built

### Backend (FastAPI + Kubernetes client)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/tenants/{id}/k8s/deployments` | GET | Yes | List K8s deployments in tenant namespace (name, ready/desired replicas, status) |
| `/tenants/{id}/k8s/pods` | GET | Yes | List pods in tenant namespace (name, phase, app label) |
| `/tenants/{id}/k8s/logs/{pod_name}?tail=100` | GET | Yes | Pod logs (tail lines 10–1000) |

- **Tenant ownership**: All three routes resolve the tenant’s `namespace` and enforce that the current user owns that tenant. No cross-tenant data.
- **K8s client**: Reuses existing `kubernetes` Python client; `deployments/service.py` adds `list_namespace_deployments`, `list_namespace_pods`, and `get_pod_logs`.

### Frontend (React)

- **Route**: `/monitoring`
- **Behaviour**:
  - Tenant dropdown (user’s tenants).
  - Table: **Deployment** | **Status** (Running / Failed / Pending) | **Pods** (ready/desired) | **Actions** (View Logs).
  - Status colours: green Running, red Failed, amber Pending.
  - **View Logs** opens a modal: choose pod (filtered by deployment’s `app` label), optional tail lines (50/100/200/500), then show logs in a scrollable `<pre>`.
  - **Auto-refresh**: `fetchK8s` runs on mount and every 5 seconds; cleanup on unmount.

### Flow

```
Frontend (Monitoring page)
       │
       ▼
FastAPI (/tenants/{id}/k8s/deployments | pods | logs/...)
       │
       ▼
Kubernetes API (list deployments, list pods, read pod log)
       │
       ▼
Cluster (Pods / Deployments / Logs)
```

---

## Backend Details

### Deployment status

- **Running**: `desired_replicas > 0` and `ready_replicas >= desired_replicas`.
- **Failed**: `desired_replicas > 0` and `ready_replicas < desired_replicas`.
- **Pending**: `desired_replicas == 0`.

### Pod list

- Each pod returns: `name`, `status` (phase), `app` (from labels, used to tie pods to deployments), `ready` (from container statuses).

### Logs

- `read_namespaced_pod_log` with `tail_lines` (default 100, max 1000 from API).
- On K8s/API errors, backend returns a short error message instead of raising.

---

## Frontend Details

- **Monitoring** uses the same auth and API base as the rest of the app (`getK8sDeployments`, `getK8sPods`, `getPodLogs`).
- Logs modal: click outside or Escape to close; selecting another pod re-fetches with current `tail` value.
- Empty states: no tenant selected, no deployments in namespace, or no pods for a deployment—all handled with clear copy.

---

## What You Achieved

- Kubernetes API integration (deployments, pods, logs).
- Deployment status API with tenant-scoped access.
- Pod list and basic logs viewer.
- Real-time feel via 5s auto-refresh.
- Observability-style dashboard that works without CLI access.

---

## Optional Next Level

- WebSockets for live log streaming.
- Prometheus metrics API and simple CPU/memory graphs.
- Alerts (e.g. deployment failed, pod crash loop).
