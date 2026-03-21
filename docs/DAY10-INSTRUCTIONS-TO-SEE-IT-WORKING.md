# Day 10 — Instructions to See It Working

Step-by-step guide to get **custom domains + Ingress + (optional) HTTPS** working so you can open your app in the browser.

---

## Prerequisites

- **Minikube** running and **ArgoCD** installed (see [Day 2 — Infrastructure Setup](day2-infrastructure-setup.md)).
- **GitOps repo** configured and ArgoCD can sync from it.
- **Backend** can push to the GitOps repo (clone, commit, push).  
  For local runs you need a GitOps repo URL and (for push) a token; or use the platform without GitOps push for manual testing.

---

## Part A — Kubernetes: Ingress + cert-manager

Do these once per cluster.

### Step 1: Enable NGINX Ingress (Minikube)

```bash
minikube addons enable ingress
```

Wait until the Ingress controller is running:

```bash
kubectl get pods -n ingress-nginx
```

You should see pods in `Running` state (e.g. `ingress-nginx-controller-...`).

---

### Step 2: Install cert-manager (for HTTPS)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

Wait for cert-manager pods:

```bash
kubectl get pods -n cert-manager
```

All should be `Running`.

---

### Step 3: Create Let's Encrypt ClusterIssuer

1. Open **`infrastructure/kubernetes/ingress/cluster-issuer.yaml`** in this repo.
2. Replace **`your-email@example.com`** with your real email (for Let's Encrypt account).
3. Apply:

```bash
kubectl apply -f infrastructure/kubernetes/ingress/cluster-issuer.yaml
```

Verify:

```bash
kubectl get clusterissuer
```

You should see `letsencrypt-prod` with `Ready=True`.

---

## Part B — Backend: Enable custom domains and Ingress

The backend generates **domain** and **Ingress** (and optionally TLS) only when **`BASE_DOMAIN`** is set.

### Step 4: Set backend environment variables

Create or edit **`backend/.env`** (or set env in your shell):

**Minimum to get a domain and Ingress (no TLS yet):**

```env
BASE_DOMAIN=local.dev
```

Use **`local.dev`** so we can test with the hosts file. No real DNS needed for this.

**Optional — enable HTTPS (only use when you have a public host and real DNS):**

```env
BASE_DOMAIN=yourplatform.com
TLS_ENABLED=true
CERT_MANAGER_ISSUER=letsencrypt-prod
INGRESS_CLASS=nginx
```

For **local Minikube testing**, keep **`TLS_ENABLED=false`** or unset, and use **`BASE_DOMAIN=local.dev`**.

---

### Step 5: Ensure backend can push to GitOps (if you deploy via platform)

- **GITOPS_REPO_URL** — your GitOps repo clone URL (e.g. `https://github.com/youruser/gitops-repo.git`).
- **Git credentials** — if the repo is private, the backend needs a token (e.g. in the clone URL or via Git config).  
  See project docs for how your backend runs (local vs Docker vs K8s) and where you set the token.

Restart the backend after changing `.env`.

---

## Part C — Create tenant and project (see the domain and Ingress)

### Step 6: Create a tenant

Use the dashboard or API:

- **Name:** e.g. `acme`
- **Namespace:** e.g. `tenant-acme` (must be a valid K8s namespace; often same as name or `tenant-<name>`).

Ensure that namespace exists in the cluster (the platform may create it when you create the tenant, depending on your setup). If not:

```bash
kubectl create namespace tenant-acme
```

---

### Step 7: Create a project

In the dashboard (or via API): create a project under that tenant, e.g.:

- **Name:** `webapp`
- **Image:** `nginx:1.27-alpine` (or any image that serves HTTP on port 80)
- **Port:** `80`

After creation, the API returns a **`domain`** field, e.g.:

- **`webapp.tenant-acme.local.dev`** (if `BASE_DOMAIN=local.dev`).

The backend will have pushed **Deployment**, **Service**, and **Ingress** to the GitOps repo. ArgoCD will sync and create the Ingress in the tenant namespace.

---

## Part D — Open the app in the browser (local Minikube)

On Minikube, the Ingress is usually reached via the Minikube IP.

**Important:** For local testing with `local.dev`, use **http** only. Do **not** use https:// — you will get an SSL error (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH`) because there is no valid certificate for `.local.dev`.

### Step 8: Get Minikube IP

```bash
minikube ip
```

Example: `192.168.49.2`

---

### Step 9: Point the domain to Minikube (hosts file)

Use the **domain** from the API (e.g. `webapp.tenant-acme.local.dev`).

**Windows** — Edit as Administrator:  
`C:\Windows\System32\drivers\etc\hosts`

**macOS / Linux:**  
`/etc/hosts`

Add one line (replace with your Minikube IP and domain):

```text
192.168.49.2   webapp.tenant-acme.local.dev
```

Save the file.

---

### Step 10: Open the app

In the browser, type or paste **exactly** (with `http://`):

```text
http://webapp.tenant-acme.local.dev
```

**Do not use https://** for local — use **http** only. You should see the app (e.g. nginx welcome page). Use HTTPS only when you have a real domain and TLS enabled (production).

---

## Part E — Verify Ingress and TLS (optional)

### Check Ingress

```bash
kubectl get ingress -n tenant-acme
```

You should see an Ingress with host `webapp.tenant-acme.local.dev` (or your domain).

### If you enabled TLS (public host + real DNS)

- Ensure **DNS** for your domain points to the Ingress LoadBalancer (or NodePort / tunnel, depending on your cluster).
- cert-manager will create a Certificate and a Secret. Check:

```bash
kubectl get certificate -n tenant-acme
kubectl get secret -n tenant-acme
```

Then open **https://your-project.tenant.yourplatform.com**.

---

## Quick checklist

| Step | What to do | How to check |
|------|------------|--------------|
| 1 | `minikube addons enable ingress` | `kubectl get pods -n ingress-nginx` |
| 2 | Apply cert-manager YAML | `kubectl get pods -n cert-manager` |
| 3 | Apply ClusterIssuer (edit email first) | `kubectl get clusterissuer` |
| 4 | Set `BASE_DOMAIN=local.dev` in backend `.env` | Restart backend |
| 5 | GitOps repo URL + token if private | Backend can clone/push |
| 6 | Create tenant (e.g. namespace `tenant-acme`) | Tenant exists in DB + cluster |
| 7 | Create project (e.g. `webapp`, nginx, port 80) | API returns `domain`; GitOps has ingress.yaml |
| 8 | `minikube ip` | Note IP |
| 9 | Add `MINIKUBE_IP webapp.tenant-acme.local.dev` to hosts file | — |
| 10 | Open `http://webapp.tenant-acme.local.dev` | App loads in browser |

---

## Troubleshooting

- **"This site can't provide a secure connection" / ERR_SSL_VERSION_OR_CIPHER_MISMATCH**  
  You are using **https://** or the browser upgraded to HTTPS. For local testing with `local.dev`, use **http://** only (e.g. `http://webapp.tenant-acme.local.dev`). Ensure `TLS_ENABLED=false` (or unset) in backend `.env` so the Ingress does not serve TLS for this host.

- **502 / connection refused**  
  - Check that the Service and Deployment exist: `kubectl get svc,deploy -n tenant-acme`.  
  - Check that the Ingress backend service name and port match (e.g. `webapp-service`, port 80).

- **Domain not in API response**  
  - Backend must have `BASE_DOMAIN` set and restarted.  
  - Response schema includes `domain` only when `BASE_DOMAIN` is set.

- **Ingress not created in cluster**  
  - ArgoCD must be syncing the GitOps repo path for that tenant/project (e.g. `tenants/tenant-acme/webapp`).  
  - In ArgoCD UI, check Application sync status and events.

- **HTTPS not working**  
  - Use TLS only with a **public** host and **real DNS** pointing at the cluster.  
  - For local Minikube, use **http** and `BASE_DOMAIN=local.dev` with the hosts file.

---

## Summary

1. Enable Ingress and cert-manager on the cluster; add the ClusterIssuer.
2. Set **`BASE_DOMAIN=local.dev`** (and optionally TLS settings) in the backend.
3. Create a tenant and a project; use the returned **`domain`**.
4. Add that domain to your **hosts file** pointing at **Minikube IP**.
5. Open **http://&lt;domain&gt;** in the browser to see the app working.

For production, set **`BASE_DOMAIN`** to your real domain, configure DNS to point to the Ingress, and set **`TLS_ENABLED=true`** so the platform generates TLS Ingress and cert-manager can issue certificates.
