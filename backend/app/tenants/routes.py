from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantResponse
from app.tenants.service import create_kubernetes_namespace, delete_kubernetes_namespace

router = APIRouter(tags=["Tenants"])


@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Tenant).filter(Tenant.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Tenant name already exists")

    namespace = create_kubernetes_namespace(payload.name)

    tenant = Tenant(
        name=payload.name,
        namespace=namespace,
        owner_id=current_user.id,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/", response_model=list[TenantResponse])
def list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Tenant)
        .filter(Tenant.owner_id == current_user.id)
        .order_by(Tenant.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: int,
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
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: int,
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

    try:
        delete_kubernetes_namespace(tenant.namespace)
    except Exception:
        pass

    db.delete(tenant)
    db.commit()
