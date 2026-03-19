from pydantic import BaseModel
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    image: str = "nginx:1.27-alpine"
    replicas: int = 2
    port: int = 80
    repo_url: str | None = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    image: str
    replicas: int
    port: int
    repo_url: str | None
    status: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime | None
    domain: str | None = None  # Day 10: e.g. webapp.tenant-a.yourplatform.com when BASE_DOMAIN set

    class Config:
        from_attributes = True
