# Issues and Fixes

Summary of known issues, what’s been fixed, and what you need to configure.

---

## Fixed

### 1. Tenant creation failed when Kubernetes was down

- **Symptom:** "Failed to create tenant" when Minikube/cluster was stopped or unreachable.
- **Cause:** Create-tenant called the Kubernetes API to create a namespace; if the cluster wasn’t available, the request failed.
- **Fix:** Tenant creation no longer depends on the cluster. The backend still tries to create the namespace when the cluster is there; if it fails (connection error, no kubeconfig, etc.), it logs a warning and still creates the tenant in the DB with the same namespace name. You can create the namespace later when the cluster is up, or create a new tenant with the cluster running.

### 2. Deployments list didn’t include `domain`

- **Symptom:** `/tenants/{id}/deployments` returned projects without the `domain` field.
- **Fix:** The deployments list response now includes `domain` (e.g. `webapp.tenant-acme.local.dev`) when `BASE_DOMAIN` is set, same as the projects list.

---

## Environment / configuration issues

These depend on your machine and how you run the app.

### 3. Kubernetes cluster unreachable (Minikube / Docker)

- **Symptom:** Minikube commands or `kubectl` fail with SSH/auth errors or "connection refused".
- **Cause:** Minikube VM not running, Docker networking issues, or VPN blocking the VM.
- **What to do:**
  - Start the cluster: `minikube start --driver=docker --cpus=2 --memory=4096`
  - If you use a VPN, try turning it off or excluding Docker/Minikube from it.
  - Restart Docker if it’s slow or unresponsive.
  - See: https://minikube.sigs.k8s.io/docs/handbook/vpn_and_proxy/

**Impact:** Tenant creation works anyway (see above). Project *creation* still saves the project but may set status to `failed: ...` if Git push or ArgoCD fails. Monitoring (pods, deployments, logs) will return empty or “unavailable” until the cluster is reachable.

### 4. GitOps repo: clone or push fails (create project)

- **Symptom:** Creating a project returns 201 but status is `failed: ...` and the message mentions git or push.
- **Repo:** [imperfect0007/gitops-repo](https://github.com/imperfect0007/gitops-repo) is **public**, so **clone** works without credentials. **Push** still requires authentication (GitHub token or SSH).
- **Causes:**
  - **Push auth:** Backend has no credentials to push (use a [Personal Access Token](https://github.com/settings/tokens) in the URL: `https://<TOKEN>@github.com/imperfect0007/gitops-repo.git`).
  - **Path:** `GITOPS_REPO_PATH` (e.g. in `.env`) is not writable or doesn’t exist and can’t be created.
  - **Network:** Can’t reach GitHub (firewall, proxy, no internet).
- **What to do:**
  - For push, set `GITOPS_REPO_URL` in `.env` to `https://<YOUR_GITHUB_TOKEN>@github.com/imperfect0007/gitops-repo.git` (create a token with `repo` scope). Keep the token secret; don’t commit `.env`.
  - Ensure `GITOPS_REPO_PATH` is a writable directory (e.g. `C:/Users/hp/Desktop/gitops-repo`).
  - Ensure the backend process can reach the internet (and proxy if you use one).

### 5. ArgoCD application create fails (create project)

- **Symptom:** Project is created and Git push may succeed, but status is `failed: ...` and the error mentions Kubernetes or ArgoCD.
- **Cause:** Backend tries to create an ArgoCD `Application` in the cluster; if the cluster is down or ArgoCD isn’t installed, that call fails.
- **What to do:** Bring the cluster up and install ArgoCD (see Day 2). The project is already in the DB and in Git; after the cluster is up, you can create the Application manually or redeploy.

---

## Security / production

### 6. Weak default `SECRET_KEY`

- **Issue:** Default in code is `change-me-in-production-use-openssl-rand-hex-32`. Using it in production is unsafe.
- **What to do:** In production, set `SECRET_KEY` in `.env` to a long random value, e.g. `openssl rand -hex 32`.

### 7. CORS `allow_origins=["*"]`

- **Issue:** Backend allows any origin. Fine for local dev; in production you should restrict origins to your frontend URL(s).

---

## Quick checklist

| Item | Check |
|------|--------|
| Tenant creation | Works even when cluster is down (fixed). |
| Project creation | Needs GitOps repo writable and pushable; optional cluster for ArgoCD. |
| Monitoring (pods/deployments/logs) | Needs cluster up and `kubectl`/API reachable. |
| Custom domains / Ingress | Needs `BASE_DOMAIN` set; TLS needs cert-manager and public DNS. |
| Minikube | Start with `minikube start`; fix VPN/Docker if SSH or connection fails. |
| GitOps repo | Use token in URL for private repo; ensure path is writable. |

If something still fails, check backend logs (uvicorn) for the exact exception and stack trace.
