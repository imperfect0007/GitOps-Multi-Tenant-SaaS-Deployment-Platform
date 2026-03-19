from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.tenant import Tenant
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectResponse
from app.projects.service import deploy_project

router = APIRouter(tags=["Projects"])


def _get_owned_tenant(tenant_id: int, db: Session, user: User) -> Tenant:
    tenant = (
        db.query(Tenant)
        .filter(Tenant.id == tenant_id, Tenant.owner_id == user.id)
        .first()
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _project_response(project: Project, namespace: str | None = None) -> ProjectResponse:
    data = ProjectResponse.model_validate(project).model_dump()
    ns = namespace or (project.tenant.namespace if project.tenant else None)
    if settings.BASE_DOMAIN and ns:
        data["domain"] = f"{project.name}.{ns}.{settings.BASE_DOMAIN}"
    return ProjectResponse(**data)


@router.post(
    "/tenants/{tenant_id}/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    tenant_id: int,
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = _get_owned_tenant(tenant_id, db, current_user)

    if db.query(Project).filter(
        Project.name == payload.name, Project.tenant_id == tenant_id
    ).first():
        raise HTTPException(status_code=400, detail="Project name already exists in this tenant")

    project = Project(
        name=payload.name,
        image=payload.image,
        replicas=payload.replicas,
        port=payload.port,
        repo_url=payload.repo_url,
        tenant_id=tenant.id,
        status="deploying",
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    try:
        deploy_project(
            name=project.name,
            namespace=tenant.namespace,
            image=project.image,
            replicas=project.replicas,
            port=project.port,
        )
        project.status = "deployed"
    except Exception as e:
        project.status = f"failed: {str(e)[:200]}"
    finally:
        db.commit()
        db.refresh(project)

    return _project_response(project, namespace=tenant.namespace)


@router.get("/tenants/{tenant_id}/projects", response_model=list[ProjectResponse])
def list_projects(
    tenant_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = _get_owned_tenant(tenant_id, db, current_user)
    projects = (
        db.query(Project)
        .filter(Project.tenant_id == tenant_id)
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_project_response(p, namespace=tenant.namespace) for p in projects]


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _get_owned_tenant(project.tenant_id, db, current_user)
    return _project_response(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _get_owned_tenant(project.tenant_id, db, current_user)

    db.delete(project)
    db.commit()
