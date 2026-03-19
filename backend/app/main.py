import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import init_db
from app.core.exceptions import global_exception_handler
import app.models  # noqa: F401 — register all models before init_db
from app.auth.routes import router as auth_router
from app.tenants.routes import router as tenant_router
from app.projects.routes import router as project_router
from app.deployments.routes import router as deployment_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    logger.info("Starting up — initializing database tables")
    init_db()
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="GitOps SaaS Platform API",
    description="Multi-tenant SaaS platform with GitOps-based Kubernetes deployments",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(Exception, global_exception_handler)

app.include_router(auth_router, prefix="/auth")
app.include_router(tenant_router, prefix="/tenants")
app.include_router(project_router, prefix="")
app.include_router(deployment_router, prefix="")


@app.get("/health")
def health():
    return {"status": "ok"}
