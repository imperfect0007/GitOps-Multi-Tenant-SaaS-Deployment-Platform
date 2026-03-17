# Day 2 — Infrastructure Setup Guide

## Prerequisites

| Tool     | Required | Check Command              |
|----------|----------|----------------------------|
| Docker   | Yes      | `docker --version`         |
| Minikube | Yes      | `minikube version`         |
| kubectl  | Yes      | `kubectl version --client` |

---

## 1. Start Minikube Cluster

```bash
minikube start --driver=docker --cpus=2 --memory=4096
```

Verify:

```bash
kubectl get nodes
```

Expected:

```
NAME       STATUS   ROLES           AGE   VERSION
minikube   Ready    control-plane   1m    v1.x.x
```

---

## 2. Install ArgoCD

### Create namespace

```bash
kubectl create namespace argocd
```

### Install ArgoCD manifests

```bash
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### Wait for pods to be ready

```bash
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
```

### Verify

```bash
kubectl get pods -n argocd
```

All pods should show `Running` status:

```
argocd-application-controller-0     Running
argocd-applicationset-controller    Running
argocd-dex-server                   Running
argocd-notifications-controller     Running
argocd-redis                        Running
argocd-repo-server                  Running
argocd-server                       Running
```

---

## 3. Access ArgoCD Dashboard

### Port-forward the server

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

### Open in browser

```
https://localhost:8080
```

### Get admin password

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

On Windows PowerShell:

```powershell
$encoded = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($encoded))
```

Login with:
- **Username:** `admin`
- **Password:** (output from above command)

---

## 4. Deploy Test Application

### Apply nginx deployment

```bash
kubectl apply -f infrastructure/kubernetes/base/test-nginx-deployment.yaml
```

### Verify pods

```bash
kubectl get pods -l app=nginx-test
```

Expected: 2 pods in `Running` state.

### Test with port-forward

```bash
kubectl port-forward svc/nginx-test 9090:80
```

Open `http://localhost:9090` — you should see the nginx welcome page.

---

## 5. Register Test App in ArgoCD (Optional)

Once the test nginx deployment is verified, you can register it as an ArgoCD Application:

```bash
kubectl apply -f infrastructure/kubernetes/base/argocd-test-app.yaml
```

This tells ArgoCD to watch the `test-nginx-deployment.yaml` in this repo and auto-sync it to the cluster.

---

## Architecture After Day 2

```
Local Machine
      │
      ▼
Docker Runtime (v29.x)
      │
      ▼
Minikube Cluster (v1.37)
      │
      ├── namespace: default
      │      └── nginx-test (2 replicas)
      │
      └── namespace: argocd
             ├── argocd-server
             ├── argocd-repo-server
             ├── argocd-application-controller
             ├── argocd-redis
             ├── argocd-dex-server
             ├── argocd-applicationset-controller
             └── argocd-notifications-controller
```

---

## Cleanup (when needed)

```bash
# Delete test app
kubectl delete -f infrastructure/kubernetes/base/test-nginx-deployment.yaml

# Stop minikube (preserves state)
minikube stop

# Delete minikube cluster entirely
minikube delete
```
