import logging

from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

logger = logging.getLogger(__name__)


def _load_k8s_config():
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()


def list_namespace_deployments(namespace: str) -> list[dict]:
    """List all deployments in a namespace with name, replicas, status."""
    try:
        _load_k8s_config()
        apps_v1 = client.AppsV1Api()
        resp = apps_v1.list_namespaced_deployment(namespace=namespace)
        result = []
        for d in resp.items:
            ready = d.status.ready_replicas or 0
            desired = d.spec.replicas or 0
            result.append({
                "name": d.metadata.name,
                "ready_replicas": ready,
                "desired_replicas": desired,
                "available_replicas": d.status.available_replicas or 0,
                "status": "Running" if (desired > 0 and ready >= desired) else ("Failed" if desired > 0 else "Pending"),
            })
        return result
    except ApiException as e:
        logger.warning("K8s list deployments failed: %s", e)
        return []
    except Exception as e:
        logger.warning("Could not reach Kubernetes API: %s", e)
        return []


def list_namespace_pods(namespace: str) -> list[dict]:
    """List all pods in a namespace with name, status, and app label."""
    try:
        _load_k8s_config()
        v1 = client.CoreV1Api()
        resp = v1.list_namespaced_pod(namespace=namespace)
        result = []
        for p in resp.items:
            labels = p.metadata.labels or {}
            result.append({
                "name": p.metadata.name,
                "status": p.status.phase or "Unknown",
                "app": labels.get("app", ""),
                "ready": next(
                    (c.ready for c in (p.status.container_statuses or []) if c.name),
                    False,
                ),
            })
        return result
    except ApiException as e:
        logger.warning("K8s list pods failed: %s", e)
        return []
    except Exception as e:
        logger.warning("Could not reach Kubernetes API: %s", e)
        return []


def get_pod_logs(namespace: str, pod_name: str, tail_lines: int = 100) -> str:
    """Fetch logs from a pod. Returns empty string on error."""
    try:
        _load_k8s_config()
        v1 = client.CoreV1Api()
        return v1.read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            tail_lines=tail_lines,
        )
    except ApiException as e:
        logger.warning("K8s pod logs failed: %s", e)
        return f"[Error fetching logs: {e.reason}]"
    except Exception as e:
        logger.warning("Could not reach Kubernetes API: %s", e)
        return "[Kubernetes API unavailable]"


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
