import logging
import re

from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

logger = logging.getLogger(__name__)


def _load_k8s_config():
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()


def _sanitize_namespace(name: str) -> str:
    sanitized = re.sub(r"[^a-z0-9-]", "-", name.lower().strip())
    return f"tenant-{sanitized}"


def create_kubernetes_namespace(tenant_name: str) -> str:
    """Create namespace (and quota, limits, network policy) in Kubernetes. On cluster unreachable, still return namespace name so tenant can be created in DB."""
    namespace = _sanitize_namespace(tenant_name)
    try:
        _load_k8s_config()
        v1 = client.CoreV1Api()
        ns_body = client.V1Namespace(
            metadata=client.V1ObjectMeta(
                name=namespace,
                labels={
                    "platform": "gitops-saas",
                    "tenant": namespace,
                    "managed-by": "platform-api",
                },
            )
        )
        try:
            v1.create_namespace(body=ns_body)
            logger.info("Created namespace %s", namespace)
        except ApiException as e:
            if e.status == 409:
                logger.info("Namespace %s already exists", namespace)
            else:
                raise
        _apply_resource_quota(v1, namespace)
        _apply_limit_range(v1, namespace)
        _apply_network_policy(namespace)
    except Exception as e:
        logger.warning("Kubernetes unavailable or error creating namespace %s: %s. Tenant will be created with namespace name; create namespace later when cluster is up.", namespace, e)
    return namespace


def _apply_resource_quota(v1: client.CoreV1Api, namespace: str):
    quota = client.V1ResourceQuota(
        metadata=client.V1ObjectMeta(name=f"{namespace}-quota"),
        spec=client.V1ResourceQuotaSpec(
            hard={
                "pods": "5",
                "requests.cpu": "2",
                "requests.memory": "2Gi",
                "limits.cpu": "4",
                "limits.memory": "4Gi",
                "services": "5",
            }
        ),
    )
    try:
        v1.create_namespaced_resource_quota(namespace=namespace, body=quota)
    except ApiException as e:
        if e.status != 409:
            raise


def _apply_limit_range(v1: client.CoreV1Api, namespace: str):
    limit_range = client.V1LimitRange(
        metadata=client.V1ObjectMeta(name=f"{namespace}-limits"),
        spec=client.V1LimitRangeSpec(
            limits=[
                client.V1LimitRangeItem(
                    type="Container",
                    default={"cpu": "500m", "memory": "512Mi"},
                    default_request={"cpu": "200m", "memory": "256Mi"},
                )
            ]
        ),
    )
    try:
        v1.create_namespaced_limit_range(namespace=namespace, body=limit_range)
    except ApiException as e:
        if e.status != 409:
            raise


def _apply_network_policy(namespace: str):
    networking_v1 = client.NetworkingV1Api()
    policy = client.V1NetworkPolicy(
        metadata=client.V1ObjectMeta(name="tenant-isolation"),
        spec=client.V1NetworkPolicySpec(
            pod_selector=client.V1LabelSelector(),
            policy_types=["Ingress", "Egress"],
            ingress=[
                client.V1NetworkPolicyIngressRule(
                    _from=[
                        client.V1NetworkPolicyPeer(
                            namespace_selector=client.V1LabelSelector(
                                match_labels={"tenant": namespace}
                            )
                        )
                    ]
                )
            ],
            egress=[
                client.V1NetworkPolicyEgressRule(
                    to=[
                        client.V1NetworkPolicyPeer(
                            namespace_selector=client.V1LabelSelector(
                                match_labels={"tenant": namespace}
                            )
                        )
                    ]
                ),
                client.V1NetworkPolicyEgressRule(
                    to=[
                        client.V1NetworkPolicyPeer(
                            namespace_selector=client.V1LabelSelector(
                                match_labels={"kubernetes.io/metadata.name": "kube-system"}
                            )
                        )
                    ],
                    ports=[client.V1NetworkPolicyPort(protocol="UDP", port=53)],
                ),
            ],
        ),
    )
    try:
        networking_v1.create_namespaced_network_policy(namespace=namespace, body=policy)
    except ApiException as e:
        if e.status != 409:
            raise


def delete_kubernetes_namespace(namespace: str):
    _load_k8s_config()
    v1 = client.CoreV1Api()
    try:
        v1.delete_namespace(name=namespace)
        logger.info("Deleted namespace %s", namespace)
    except ApiException as e:
        if e.status != 404:
            raise
