# Day 10 — Final Production Setup (Real Startup Level)

## Goal

Turn the platform from **"great project" → "production-grade"**: custom domains, HTTPS, Ingress routing, and production polish.

```
User → Custom Domain → HTTPS → Ingress → Kubernetes → App
```

Your platform will behave like **Vercel** or **Heroku**.

---

## 1. Ingress Controller Setup

We need a way to expose apps to the internet.

### NGINX Ingress Controller

**Minikube:**

```bash
minikube addons enable ingress
```

**Check:**

```bash
kubectl get pods -n ingress-nginx
```

**Other clusters:** Install via [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/deploy/).

---

## 2. Ingress for Your App

Example Ingress (per-tenant, per-app):

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: tenant-a
spec:
  ingressClassName: nginx
  rules:
  - host: webapp.tenant-a.yourplatform.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: webapp-service
            port:
              number: 80
```

### Test locally

1. Edit hosts file:
   ```text
   127.0.0.1 app.local
   ```
2. Use an Ingress with `host: app.local` and open: `http://app.local`

---

## 3. HTTPS Setup (SSL)

### Install cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

### ClusterIssuer (Let's Encrypt)

See **`infrastructure/kubernetes/ingress/cluster-issuer.yaml`** in this repo (or apply the YAML below).

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: your-email@gmail.com
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### Ingress with TLS

Add to your Ingress `spec`:

```yaml
spec:
  tls:
  - hosts:
    - webapp.tenant-a.yourplatform.com
    secretName: webapp-tenant-a-tls
  rules:
  - host: webapp.tenant-a.yourplatform.com
    ...
```

Add annotation for cert-manager (if not using ingress-shim):

```yaml
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
```

---

## 4. Custom Domains per Tenant (SaaS-Level)

Each tenant (and each project) gets a subdomain:

- `webapp.tenant-a.yourplatform.com`
- `api.tenant-b.yourplatform.com`

The **backend** generates the domain and Ingress YAML when a project is created:

1. Generate domain: `{project}.{tenant_namespace}.{BASE_DOMAIN}`
2. Create Deployment, Service, **Ingress** (and optional TLS)
3. Push to GitOps repo → ArgoCD syncs → app is reachable at HTTPS URL

Set in backend env:

- `BASE_DOMAIN=yourplatform.com` (your root domain)
- `TLS_ENABLED=true` (use cert-manager)
- `CERT_MANAGER_ISSUER=letsencrypt-prod`

---

## 5. Backend Logic (Day 10 Upgrade)

When a project is created:

1. **Generate domain:** `{project}.{namespace}.{BASE_DOMAIN}`
2. **Generate manifests:** Deployment (with health checks), Service, **Ingress** (with optional TLS)
3. **Push to GitOps repo**
4. **Create ArgoCD Application** (unchanged)

New/updated pieces:

- **`app/core/config.py`**: `BASE_DOMAIN`, `TLS_ENABLED`, `CERT_MANAGER_ISSUER`, `INGRESS_CLASS`
- **`app/gitops/manifests.py`**: `generate_ingress()`, optional probes on Deployment
- **`app/projects/service.py`**: If `BASE_DOMAIN` is set, add `ingress.yaml` to manifests and use TLS when `TLS_ENABLED` is true
- **API response**: Project can include `domain` (e.g. `webapp.tenant-a.yourplatform.com`) for the dashboard

---

## 6. Final Architecture (Production)

```
                    User
                     │
                     ▼
             Custom Domain (DNS)
                     │
                     ▼
              Ingress Controller
                     │
                     ▼
             Kubernetes Cluster
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   tenant-a      tenant-b     tenant-c
      │              │            │
   apps          apps         apps
```

---

## 7. Optional Production Features

### Auto domain provisioning

- Generate subdomain automatically (already done in backend)
- Map DNS: Cloudflare API or Route53 to create `CNAME` or `A` records pointing at your Ingress LB

### Deployment history

- Store image digest/version in DB per deployment
- Expose "Rollback to previous version" in dashboard

### Health checks (included in generated Deployment)

```yaml
livenessProbe:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 10
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /
    port: 80
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Horizontal scaling (HPA)

Example in **`infrastructure/kubernetes/ingress/hpa-example.yaml`**:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp
  namespace: tenant-a
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## 8. Final Project Capabilities

The platform now supports:

- Multi-tenant SaaS
- GitOps deployments (ArgoCD)
- CI/CD automation (GitHub Actions)
- Kubernetes orchestration
- Monitoring dashboard
- **Secure HTTPS access** (cert-manager + Let's Encrypt)
- **Custom domains per project** (e.g. `project.tenant.yourplatform.com`)

This is **startup-level product**.

---

## 9. Resume (Final Version)

> Built a production-grade GitOps-based multi-tenant SaaS deployment platform using Kubernetes, ArgoCD, Docker, and FastAPI, enabling automated application deployments with CI/CD pipelines, tenant isolation, monitoring, secure HTTPS access, and custom domains.

---

## What Next?

1. **Deploy online** — AWS / GCP / Azure, make it publicly accessible.
2. **Add AI** — Deployment assistant, auto root-cause detection.
3. **Turn into startup** — Billing, launch MVP.

This project already covers **DevOps**, **Full Stack**, **System Design**, and **Cloud Architecture** at a high level.
