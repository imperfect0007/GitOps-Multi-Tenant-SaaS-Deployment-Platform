"""Kubernetes manifest generation for tenant projects."""

import yaml


def generate_deployment(
    name: str, namespace: str, image: str, replicas: int, port: int, add_probes: bool = True
) -> str:
    container = {
        "name": name,
        "image": image,
        "ports": [{"containerPort": port}],
        "resources": {
            "requests": {"cpu": "100m", "memory": "128Mi"},
            "limits": {"cpu": "200m", "memory": "256Mi"},
        },
    }
    if add_probes and port:
        container["livenessProbe"] = {
            "httpGet": {"path": "/", "port": port},
            "initialDelaySeconds": 10,
            "periodSeconds": 10,
        }
        container["readinessProbe"] = {
            "httpGet": {"path": "/", "port": port},
            "initialDelaySeconds": 5,
            "periodSeconds": 5,
        }
    manifest = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {
            "name": name,
            "namespace": namespace,
            "labels": {"app": name, "tenant": namespace},
        },
        "spec": {
            "replicas": replicas,
            "selector": {"matchLabels": {"app": name, "tenant": namespace}},
            "template": {
                "metadata": {"labels": {"app": name, "tenant": namespace}},
                "spec": {
                    "containers": [container],
                },
            },
        },
    }
    return yaml.dump(manifest, default_flow_style=False)


def generate_service(name: str, namespace: str, port: int) -> str:
    manifest = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": f"{name}-service",
            "namespace": namespace,
            "labels": {"app": name, "tenant": namespace},
        },
        "spec": {
            "type": "ClusterIP",
            "selector": {"app": name, "tenant": namespace},
            "ports": [{"port": port, "targetPort": port}],
        },
    }
    return yaml.dump(manifest, default_flow_style=False)


def generate_ingress(
    name: str,
    namespace: str,
    host: str,
    service_name: str,
    service_port: int,
    ingress_class: str = "nginx",
    tls_secret_name: str | None = None,
    cert_manager_issuer: str | None = None,
) -> str:
    """Generate Ingress manifest. service_name should match the Service (e.g. {name}-service)."""
    metadata: dict = {"name": f"{name}-ingress", "namespace": namespace}
    if cert_manager_issuer and tls_secret_name:
        metadata["annotations"] = {"cert-manager.io/cluster-issuer": cert_manager_issuer}
    spec: dict = {
        "ingressClassName": ingress_class,
        "rules": [
            {
                "host": host,
                "http": {
                    "paths": [
                        {
                            "path": "/",
                            "pathType": "Prefix",
                            "backend": {
                                "service": {
                                    "name": service_name,
                                    "port": {"number": service_port},
                                }
                            },
                        }
                    ]
                },
            }
        ],
    }
    if tls_secret_name:
        spec["tls"] = [{"hosts": [host], "secretName": tls_secret_name}]
    manifest = {
        "apiVersion": "networking.k8s.io/v1",
        "kind": "Ingress",
        "metadata": metadata,
        "spec": spec,
    }
    return yaml.dump(manifest, default_flow_style=False)


def generate_argocd_application(
    name: str, tenant_namespace: str, repo_url: str, branch: str = "main"
) -> str:
    manifest = {
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "Application",
        "metadata": {
            "name": f"{tenant_namespace}-{name}",
            "namespace": "argocd",
            "labels": {"tenant": tenant_namespace},
        },
        "spec": {
            "project": "default",
            "source": {
                "repoURL": repo_url,
                "targetRevision": branch,
                "path": f"tenants/{tenant_namespace}/{name}",
            },
            "destination": {
                "server": "https://kubernetes.default.svc",
                "namespace": tenant_namespace,
            },
            "syncPolicy": {
                "automated": {"prune": True, "selfHeal": True},
                "syncOptions": ["CreateNamespace=false"],
            },
        },
    }
    return yaml.dump(manifest, default_flow_style=False)
