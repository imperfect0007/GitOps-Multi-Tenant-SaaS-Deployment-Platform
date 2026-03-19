"""Kubernetes manifest generation for tenant projects."""

import yaml


def generate_deployment(name: str, namespace: str, image: str, replicas: int, port: int) -> str:
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
                    "containers": [
                        {
                            "name": name,
                            "image": image,
                            "ports": [{"containerPort": port}],
                            "resources": {
                                "requests": {"cpu": "100m", "memory": "128Mi"},
                                "limits": {"cpu": "200m", "memory": "256Mi"},
                            },
                        }
                    ]
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
