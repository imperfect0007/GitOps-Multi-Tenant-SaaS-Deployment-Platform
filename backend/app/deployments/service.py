import logging

from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

logger = logging.getLogger(__name__)


def _load_k8s_config():
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()


def get_deployment_status(name: str, namespace: str) -> dict:
    try:
        _load_k8s_config()
        apps_v1 = client.AppsV1Api()
        deployment = apps_v1.read_namespaced_deployment(name=name, namespace=namespace)

        return {
            "available_replicas": deployment.status.available_replicas or 0,
            "ready_replicas": deployment.status.ready_replicas or 0,
            "desired_replicas": deployment.spec.replicas,
            "conditions": [
                {
                    "type": c.type,
                    "status": c.status,
                    "message": c.message,
                }
                for c in (deployment.status.conditions or [])
            ],
        }
    except ApiException as e:
        if e.status == 404:
            return {"error": "Deployment not found in cluster", "status_code": 404}
        return {"error": str(e), "status_code": e.status}
    except Exception as e:
        logger.warning("Could not reach Kubernetes API: %s", e)
        return {"error": "Kubernetes API unavailable", "detail": str(e)}
