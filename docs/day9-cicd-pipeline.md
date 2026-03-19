# Day 9 — CI/CD Pipeline + Docker + Automation

## Goal

Fully automate the path from code push to running app: **no manual build or deploy steps**.

```
Code Push → Build → Docker Image → Push → GitOps Update → Auto Deploy
```

---

## What Was Built

### 1. Backend Docker

- **`backend/Dockerfile`** (existing, kept): Python 3.11-slim, installs git (for GitOps), `uvicorn` on port 8000.
- **`backend/.dockerignore`**: Excludes `__pycache__`, `.venv`, `*.db`, `.env`, tests, etc., for smaller images.

**Build and run locally:**

```bash
cd backend
docker build -t your-dockerhub-username/backend:latest .
docker run -p 8000:8000 your-dockerhub-username/backend:latest
```

### 2. Frontend (Dashboard) Docker

- **`dashboard/Dockerfile`**: Multi-stage.
  - **Stage 1**: Node 20 — `npm ci`, `npm run build` → produces `dist/`.
  - **Stage 2**: nginx:alpine — copies `dist/` into `/usr/share/nginx/html`, SPA routing via `try_files $uri $uri/ /index.html`.
- **`dashboard/.dockerignore`**: Excludes `node_modules`, `dist`, `.git`, etc.

**Build and run locally:**

```bash
cd dashboard
docker build -t your-dockerhub-username/frontend:latest .
docker run -p 80:80 your-dockerhub-username/frontend:latest
```

### 3. GitHub Actions CI/CD

**File:** `.github/workflows/deploy.yml`

**Trigger:** Push to `main`.

**Job 1: `build-and-push`**

1. Checkout repo.
2. Set up Docker Buildx.
3. Log in to Docker Hub (`DOCKER_USERNAME`, `DOCKER_PASSWORD`).
4. Build and push **backend** image: `USERNAME/backend:latest` and `USERNAME/backend:SHA`.
5. Build and push **frontend** image: `USERNAME/frontend:latest` and `USERNAME/frontend:SHA`.

Uses GitHub Actions cache for Docker layers.

**Job 2: `update-gitops`** (optional)

- Runs only if **`GITOPS_TOKEN`** and **`GITOPS_REPO_URL`** are set.
1. Clone the GitOps repo using the token.
2. Create or update `infrastructure/platform-backend/deployment.yaml` with the new backend image (`USERNAME/backend:latest`).
3. Commit and push (e.g. message: `ci: update platform-backend image`).

ArgoCD (or any GitOps controller) watching that repo will then deploy the new image.

---

## GitHub Secrets

In the repo: **Settings → Secrets and variables → Actions**.

| Secret | Required | Description |
|--------|----------|-------------|
| `DOCKER_USERNAME` | Yes | Docker Hub username. |
| `DOCKER_PASSWORD` | Yes | Docker Hub password or access token. |
| `GITOPS_REPO_URL` | No | GitOps repo as `owner/repo` (e.g. `imperfect0007/gitops-repo`). |
| `GITOPS_TOKEN` | No | GitHub PAT with `repo` scope, to push to the GitOps repo. |

If `GITOPS_REPO_URL` and `GITOPS_TOKEN` are set, the workflow updates the GitOps repo; otherwise it only builds and pushes images.

---

## Flow

```
Developer pushes to main
        │
        ▼
GitHub Actions: build-and-push
        │
        ├── Build backend image → Push to Docker Hub (backend:latest, backend:SHA)
        └── Build frontend image → Push to Docker Hub (frontend:latest, frontend:SHA)
        │
        ▼
GitHub Actions: update-gitops (if secrets set)
        │
        ├── Clone GitOps repo
        ├── Create/update infrastructure/platform-backend/deployment.yaml (image: USERNAME/backend:latest)
        └── Commit and push
        │
        ▼
ArgoCD (or other GitOps controller) detects change
        │
        ▼
Deploy/rollout to Kubernetes
```

---

## GitOps Repo Layout (optional)

If you use the `update-gitops` job, the GitOps repo can look like:

```
gitops-repo/
  infrastructure/
    platform-backend/
      deployment.yaml   # created/updated by CI with image: DOCKER_USERNAME/backend:latest
  tenants/
    tenant-a/
      ...
```

ArgoCD can watch `infrastructure/platform-backend/` (or the whole repo) and apply changes.

---

## Testing the Pipeline

1. Add the required secrets (`DOCKER_USERNAME`, `DOCKER_PASSWORD`).
2. Make a small change (e.g. a comment in `backend/app/main.py`).
3. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "ci: test pipeline"
   git push origin main
   ```
4. In the repo, open **Actions** and watch the workflow run.
5. On Docker Hub, confirm `backend:latest` and `frontend:latest` (and SHA tags) were updated.
6. If GitOps secrets are set, check the GitOps repo for a new commit and that ArgoCD syncs.

---

## What You Achieved

- Dockerized backend and frontend.
- CI/CD pipeline on push to `main` (build + push images).
- Optional GitOps update for platform-backend image.
- No manual build or push; ArgoCD (or similar) can handle deploy.

---

## Interview Line

> Built a fully automated CI/CD pipeline using GitHub Actions and Docker, integrated with a GitOps repo so ArgoCD can continuously deploy the platform to Kubernetes with no manual steps.
