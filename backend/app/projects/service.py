import logging

from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

from app.core.config import settings
from app.gitops.manifests import (
    generate_deployment,
    generate_service,
    generate_ingress,
    generate_argocd_application,
)
from app.gitops.service import push_manifests

logger = logging.getLogger(__name__)


def deploy_project(name: str, namespace: str, image: str, replicas: int, port: int):
    """
    Full deployment pipeline:
    1. Generate K8s manifests (Deployment, Service, optional Ingress)
    2. Push to GitOps repo
    3. Create ArgoCD Application
    """
    deployment_yaml = generate_deployment(name, namespace, image, replicas, port)
    service_yaml = generate_service(name, namespace, port)

    manifests = {
        "deployment.yaml": deployment_yaml,
        "service.yaml": service_yaml,
    }

    if settings.BASE_DOMAIN:
        host = f"{name}.{namespace}.{settings.BASE_DOMAIN}"
        service_name = f"{name}-service"
        tls_secret = f"{name}-{namespace}-tls" if settings.TLS_ENABLED else None
        issuer = settings.CERT_MANAGER_ISSUER if settings.TLS_ENABLED else None
        ingress_yaml = generate_ingress(
            name=name,
            namespace=namespace,
            host=host,
            service_name=service_name,
            service_port=port,
            ingress_class=settings.INGRESS_CLASS,
            tls_secret_name=tls_secret,
            cert_manager_issuer=issuer,
        )
        manifests["ingress.yaml"] = ingress_yaml

    push_manifests(namespace, name, manifests)

    _create_argocd_application(name, namespace)

    logger.info("Project %s deployed to %s via GitOps", name, namespace)


def _create_argocd_application(name: str, namespace: str):
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()

    api = client.CustomObjectsApi()
    app_name = f"{namespace}-{name}"

    app_body = {
        "apiVersion": "argoproj.io/v1alpha1",
        "kind": "Application",
        "metadata": {
            "name": app_name,
            "namespace": "argocd",
            "labels": {"tenant": namespace},
        },
        "spec": {
            "project": "default",
            "source": {
                "repoURL": settings.GITOPS_REPO_URL,
                "targetRevision": settings.GIT_BRANCH,
                "path": f"tenants/{namespace}/{name}",
            },
            "destination": {
                "server": "https://kubernetes.default.svc",
                "namespace": namespace,
            },
            "syncPolicy": {
                "automated": {"prune": True, "selfHeal": True},
                "syncOptions": ["CreateNamespace=false"],
            },
        },
    }

    try:
        api.create_namespaced_custom_object(
            group="argoproj.io",
            version="v1alpha1",
            namespace="argocd",
            plural="applications",
            body=app_body,
        )
        logger.info("Created ArgoCD application %s", app_name)
    except ApiException as e:
        if e.status == 409:
            logger.info("ArgoCD application %s already exists, patching", app_name)
            api.patch_namespaced_custom_object(
                group="argoproj.io",
                version="v1alpha1",
                namespace="argocd",
                plural="applications",
                name=app_name,
                body=app_body,
            )
        else:
            raise
