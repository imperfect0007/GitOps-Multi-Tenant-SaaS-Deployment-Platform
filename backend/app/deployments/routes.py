from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.tenant import Tenant
from app.models.project import Project
from app.schemas.project import ProjectResponse
from app.deployments.service import (
    get_deployment_status,
    list_namespace_deployments,
    list_namespace_pods,
    get_pod_logs,
)

router = APIRouter(tags=["Deployments"])


@router.get("/tenants/{tenant_id}/deployments", response_model=list[ProjectResponse])
def list_deployments(
    tenant_id: int,
    status_filter: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = (
        db.query(Tenant)
        .filter(Tenant.id == tenant_id, Tenant.owner_id == current_user.id)
        .first()
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    query = db.query(Project).filter(Project.tenant_id == tenant_id)
    if status_filter:
        query = query.filter(Project.status == status_filter)

    return query.order_by(Project.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/deployments/{project_id}/status")
def deployment_status(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tenant = (
        db.query(Tenant)
        .filter(Tenant.id == project.tenant_id, Tenant.owner_id == current_user.id)
        .first()
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Project not found")

    k8s_status = get_deployment_status(project.name, tenant.namespace)

    return {
        "project_id": project.id,
        "project_name": project.name,
        "namespace": tenant.namespace,
        "platform_status": project.status,
        "kubernetes": k8s_status,
    }


def _get_tenant_namespace(tenant_id: int, db: Session, user: User) -> str:
    tenant = (
        db.query(Tenant)
        .filter(Tenant.id == tenant_id, Tenant.owner_id == user.id)
        .first()
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant.namespace


@router.get("/tenants/{tenant_id}/k8s/deployments")
def get_k8s_deployments(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List Kubernetes deployments in the tenant's namespace."""
    namespace = _get_tenant_namespace(tenant_id, db, current_user)
    return list_namespace_deployments(namespace)


@router.get("/tenants/{tenant_id}/k8s/pods")
def get_k8s_pods(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List pods in the tenant's namespace."""
    namespace = _get_tenant_namespace(tenant_id, db, current_user)
    return list_namespace_pods(namespace)


@router.get("/tenants/{tenant_id}/k8s/logs/{pod_name}")
def get_k8s_pod_logs(
    tenant_id: int,
    pod_name: str,
    tail: int = Query(100, ge=10, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch logs from a pod in the tenant's namespace."""
    namespace = _get_tenant_namespace(tenant_id, db, current_user)
    logs = get_pod_logs(namespace, pod_name, tail_lines=tail)
    return {"logs": logs, "pod": pod_name, "namespace": namespace}
