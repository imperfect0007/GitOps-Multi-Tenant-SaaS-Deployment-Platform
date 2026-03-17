# Day 3 — GitOps Pipeline: Git → ArgoCD → Kubernetes

## Goal

Achieve **automatic deployment** where pushing to a Git repository triggers Kubernetes deployments — no manual `kubectl apply` needed.

```
GitHub Repo → ArgoCD detects change → Deploys to Kubernetes → App Running
```

---

## Architecture

```
┌──────────────────┐
│   gitops-repo    │  (GitHub)
│   apps/nginx/    │
│    deployment    │
│    service       │
└────────┬─────────┘
         │  ArgoCD polls every ~3 min
         ▼
┌──────────────────┐
│     ArgoCD       │  (running in argocd namespace)
│  - Compares Git  │
│    vs Cluster    │
│  - Auto-syncs    │
└────────┬─────────┘
         │  kubectl apply (automated)
         ▼
┌──────────────────┐
│   Kubernetes     │
│  namespace:      │
│   default        │
│  - nginx (4 rep) │
│  - nginx-service │
│    NodePort:30007│
└──────────────────┘
```

---

## What Was Set Up

### 1. GitOps Repository (separate repo)

**Repo:** https://github.com/imperfect0007/gitops-repo

```
gitops-repo/
├── apps/
│   └── nginx/
│       ├── deployment.yaml    # nginx:1.27-alpine, 4 replicas
│       └── service.yaml       # NodePort on 30007
└── README.md
```

This repo is the **single source of truth** for all deployments.

### 2. ArgoCD Application

Created an ArgoCD Application resource (`argocd-nginx-app.yaml`) that:

- **Watches:** `https://github.com/imperfect0007/gitops-repo.git`
- **Path:** `apps/nginx`
- **Deploys to:** `https://kubernetes.default.svc` in namespace `default`
- **Auto-Sync:** enabled (prune + selfHeal)

### 3. Sync Policy

| Setting    | Value | Meaning                                           |
|------------|-------|---------------------------------------------------|
| automated  | true  | ArgoCD auto-deploys on Git changes                |
| prune      | true  | Resources deleted from Git are removed from cluster|
| selfHeal   | true  | Manual cluster changes are reverted to match Git   |

---

## GitOps Flow Verified

### Initial Deploy (2 replicas)

1. Pushed `deployment.yaml` with `replicas: 2` to gitops-repo
2. Created ArgoCD Application
3. ArgoCD synced → 2 nginx pods running

### Scale Test (2 → 4 replicas)

1. Changed `replicas: 2` to `replicas: 4` in `deployment.yaml`
2. Pushed to GitHub: `git push origin main`
3. ArgoCD detected the change within ~3 minutes
4. ArgoCD auto-applied the update
5. Result: **4 nginx pods running** — zero manual intervention

---

## Key Commands Reference

### Check ArgoCD Application status

```bash
kubectl get applications -n argocd
```

### Check deployed pods

```bash
kubectl get pods -l app=nginx
```

### Access the application

```bash
minikube service nginx-service --url
```

Or directly via: `http://<minikube-ip>:30007`

### Access ArgoCD Dashboard

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Open: `https://localhost:8080`

---

## Key Concept: GitOps

> Application state is managed **declaratively** through Git repositories.
> ArgoCD ensures the cluster always matches what's defined in Git.
> Any drift (manual changes) is automatically corrected.

This is the foundation that the entire multi-tenant SaaS platform will be built on.
