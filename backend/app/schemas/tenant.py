from pydantic import BaseModel
from datetime import datetime


class TenantCreate(BaseModel):
    name: str


class TenantResponse(BaseModel):
    id: int
    name: str
    namespace: str
    owner_id: int
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True
