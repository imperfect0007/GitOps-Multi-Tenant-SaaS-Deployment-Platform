from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.tenant import Tenant
from app.models.project import Project
from app.schemas.project import ProjectResponse
from app.deployments.service import get_deployment_status

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
